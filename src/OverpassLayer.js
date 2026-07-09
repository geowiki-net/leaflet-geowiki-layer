/* eslint camelcase: 0 */
require('./OverpassLayer.css')

const ee = require('event-emitter')
const BoundingBox = require('boundingbox')
const twig = require('twig')
const OverpassFrontend = require('overpass-frontend/src/defines')
OverpassFrontend.Filter = require('overpass-frontend/src/Filter')
const escapeHtml = require('html-escape')
const turf = {
  intersect: require('@turf/intersect').default
}

const Sublayer = require('./Sublayer')
const Memberlayer = require('./Memberlayer')
const compileFeature = require('./compileFeature')
const compileTemplate = require('./compileTemplate')

class OverpassLayer {
  constructor (options) {
    if (!options) {
      options = {}
    }

    this.options = options

    this.overpassFrontend = 'overpassFrontend' in this.options ? this.options.overpassFrontend : global.overpassFrontend
    this.options.minZoom = 'minZoom' in this.options ? this.options.minZoom : 16
    this.options.maxZoom = 'maxZoom' in this.options ? this.options.maxZoom : undefined
    this.options.feature = 'feature' in this.options ? this.options.feature : {}
    this.options.feature.style = 'style' in this.options.feature ? this.options.feature.style : {}
    this.options.feature.title = 'title' in this.options.feature ? this.options.feature.title : function (ob) { return escapeHtml(ob.tags.name || ob.tags.operator || ob.tags.ref || ob.id) }
    this.options.feature.body = 'body' in this.options.feature ? this.options.feature.body : ''
    this.options.feature.markerSymbol = 'markerSymbol' in this.options.feature ? this.options.feature.markerSymbol : '<img anchorX="13" anchorY="42" width="25" height="42" signAnchorX="0" signAnchorY="-30" src="img/map_pointer.png">'
    this.options.feature.markerSign = 'markerSign' in this.options.feature ? this.options.feature.markerSign : null
    this.options.queryOptions = 'queryOptions' in this.options ? this.options.queryOptions : {}
    if (!('properties' in this.options.queryOptions)) {
      this.options.queryOptions.properties = OverpassFrontend.ALL
    }
    this.options.styleNoBindPopup = this.options.styleNoBindPopup || []
    this.options.stylesNoAutoShow = this.options.stylesNoAutoShow || []
    this.options.layouts = this.options.layouts || {}
    this.options.layouts.popup = this.options.layouts.popup ||
      '<h1>{{ object.popupTitle|default(object.title) }}</h1>' +
      '{% if object.popupDescription or object.description %}<div class="description">{{ object.popupDescription|default(object.description) }}</div>{% endif %}' +
      '{% if object.popupBody or object.body %}<div class="body">{{ object.popupBody|default(object.body) }}</div>{% endif %}'

    compileFeature(this.options.feature, twig, { autoescape: true })
    compileFeature(this.options.layouts, twig, { autoescape: false })

    this.currentRequest = null
    this.lastZoom = null

    this.mainlayer = new Sublayer(this, options)

    this.subLayers = {
      main: this.mainlayer
    }

    if (this.options.members) {
      this.options.queryOptions.properties = OverpassFrontend.TAGS | OverpassFrontend.META | OverpassFrontend.MEMBERS | OverpassFrontend.BBOX
      this.options.queryOptions.memberProperties = OverpassFrontend.ALL
      this.options.queryOptions.members = true

      const memberOptions = {
        id: this.options.id,
        sublayer_id: 'member',
        minZoom: this.options.minZoom,
        maxZoom: this.options.maxZoom,
        feature: this.options.memberFeature,
        styleNoBindPopup: this.options.styleNoBindPopup || [],
        stylesNoAutoShow: this.options.stylesNoAutoShow || [],
        layouts: this.options.layouts,
        const: this.options.const
      }
      if (this.options.updateAssets) {
        memberOptions.updateAssets = this.options.updateAssets
      }
      compileFeature(memberOptions.feature, twig)

      this.memberlayer = new Memberlayer(this, memberOptions)
      this.subLayers.member = this.memberlayer
    }
  }

  setBounds (bounds) {
    this.options.bounds = bounds
    this.check_update_map()
  }

  setLayout (id, layout) {
    this.options.layouts[id] = compileTemplate(layout, twig, { autoescape: false })
  }

  // compatibilty Leaflet Layerswitcher
  _layerAdd (e) {
    this.addTo(e.target)
  }

  // compatibilty Leaflet Layerswitcher
  onRemove () {
    this.remove()
  }

  // compatibilty Leaflet Layerswitcher - use emit instead
  fire () {
  }

  addTo (map) {
    this.map = map
    this.emit('layeradd')
    this.map.on('moveend', this.check_update_map, this)
    for (const k in this.subLayers) {
      this.subLayers[k].addTo(map)
    }
    this.check_update_map()

    this.map.createPane('hover')
    this.map.getPane('hover').style.zIndex = 499
  }

  hideAll (force) {
    for (const k in this.subLayers) {
      this.subLayers[k].hideAll(force)
    }
  }

  remove () {
    for (const k in this.subLayers) {
      this.subLayers[k].hideAll(true)
      this.subLayers[k].remove()
    }

    this.abortRequest()
    this.emit('layerremove')

    this.map.off('moveend', this.check_update_map, this)
    this.map = null
  }

  abortRequest () {
    if (this.currentRequest) {
      if (this.onLoadEnd) {
        this.onLoadEnd({
          request: this.currentRequest,
          error: null
        })
      }

      this.currentRequest.abort()
      this.currentRequest = null
    }
  }

  /**
   * set an additional filter. Will intiate a check_update_map()
   * @param {OverpassFrontend.Filter|object|null} filter A filter. See OverpassFrontend.Filter for details.
   */
  setFilter (filter) {
    this.filter = filter
    this.check_update_map()
    this.recalc()
  }

  calcGlobalTwigData () {
    this.globalTwigData = {
      map: {
        zoom: this.map.getZoom(),
        // from: https://stackoverflow.com/a/31266377
        metersPerPixel: 40075016.686 * Math.abs(Math.cos(this.map.getCenter().lat / 180 * Math.PI)) / Math.pow(2, this.map.getZoom() + 8)
      }
    }

    this.emit('globalTwigData', this.globalTwigData)
  }

  check_update_map () {
    if (!this.map || !this.map._loaded) {
      return
    }

    const queryOptions = JSON.parse(JSON.stringify(this.options.queryOptions))
    let bounds = new BoundingBox(this.map.getBounds())

    if (this.options.bounds) {
      bounds = turf.intersect(bounds.toGeoJSON(), this.options.bounds)

      if (!bounds) {
        for (const k in this.subLayers) {
          this.subLayers[k].hideAll()
        }
        return
      }
    }

    if (this.map.getZoom() < this.options.minZoom ||
       (this.options.maxZoom !== undefined && this.map.getZoom() > this.options.maxZoom)) {
      for (const k in this.subLayers) {
        this.subLayers[k].hideAll()
      }

      // abort remaining request
      this.abortRequest()

      return
    }

    for (const k in this.subLayers) {
      this.subLayers[k].hideNonVisible(bounds)
    }

    let query = this.options.query
    if (typeof query === 'object') {
      query = query[Object.keys(query).filter(function (x) { return x <= this.map.getZoom() }.bind(this)).reverse()[0]]
    }

    if (query !== this.lastQuery) {
      const filter = new OverpassFrontend.Filter(query)
      this.mainlayer.hideNonVisibleFilter(filter)
      this.lastQuery = query
    }

    queryOptions.filter = this.filter
    if (this.filter !== this.lastFilter) {
      const filter = new OverpassFrontend.Filter(this.filter)
      this.mainlayer.hideNonVisibleFilter(filter)
      this.lastFilter = this.filter
    }

    // update global twig data
    this.calcGlobalTwigData()

    // When zoom level changed, update visible objects
    if (this.lastZoom !== this.map.getZoom()) {
      for (const k in this.subLayers) {
        this.subLayers[k].zoomChange()
      }
      this.lastZoom = this.map.getZoom()
    }

    // Abort current requests (in case they are long-lasting - we don't need them
    // anyway). Data which is being submitted will still be loaded to the cache.
    this.abortRequest()

    if (!query) {
      return
    }

    for (const k in this.subLayers) {
      this.subLayers[k].startAdding()
    }

    if (this.options.members) {
      queryOptions.memberBounds = bounds
      queryOptions.memberCallback = (err, ob) => {
        if (err) {
          return console.error('unexpected error', err)
        }

        this.memberlayer.add(ob)
      }
    }

    this.currentRequest = this.overpassFrontend.BBoxQuery(query, bounds,
      queryOptions,
      (err, ob) => {
        if (err) {
          console.log('unexpected error', err)
        }

        this.mainlayer.add(ob)
      },
      function (err) {
        if (this.onLoadEnd) {
          this.onLoadEnd({
            request: this.currentRequest,
            error: err
          })
        }

        for (const k in this.subLayers) {
          this.subLayers[k].finishAdding()
        }

        this.currentRequest = null
      }.bind(this)
    )

    if (this.onLoadStart) {
      this.onLoadStart({
        request: this.currentRequest
      })
    }
  }

  recalc () {
    if (!this.map || !this.map._loaded) {
      return
    }

    this.calcGlobalTwigData()
    for (const k in this.subLayers) {
      this.subLayers[k].recalc()
    }
  }

  scheduleReprocess (id) {
    for (const k in this.subLayers) {
      this.subLayers[k].scheduleReprocess(id)
    }
  }

  updateAssets (div, objectData) {
    for (const k in this.subLayers) {
      this.subLayers[k].updateAssets(div, objectData)
    }
  }

  get (id, callback) {
    let done = false

    this.overpassFrontend.get(id,
      {
        properties: OverpassFrontend.ALL
      },
      (err, ob) => {
        if (err === null) {
          callback(err, ob)
        }

        done = true
      },
      (err) => {
        if (!done) {
          callback(err, null)
        }
      }
    )
  }

  show (id, options, callback) {
    let sublayer = this.mainlayer
    if (options.sublayer_id) {
      sublayer = this.subLayers[options.sublayer_id]
    }

    const request = sublayer.show(id, options, callback)
    const result = {
      id: id,
      sublayer_id: options.sublayer_id,
      options: options,
      hide: request.hide
    }

    return result
  }

  hide (id) {
    this.mainlayer.hide(id)
  }

  openPopupOnObject (ob, sublayer = 'main') {
    this.subLayers[sublayer].openPopupOnObject(ob)
  }

  /**
   * get the degrees by which the world should be shifted, to show map features at the current view port (e.g. when you wrap over -180 or 180 longitude). E.g. near lon 180, the Eastern hemisphere (lon 0 .. 180) does not have to be shifted, the Western hemisphere (lon -180 .. 0) has to be shifted by 360 degrees.
   * @return {number[]} An array with two elements: degrees to shift the Western hemisphere, degrees to shift the Eastern hemisphere. Each value is a multiple of 360.
   */
  getShiftWorld () {
    return [
      Math.floor((this.map.getCenter().lng + 270) / 360) * 360,
      Math.floor((this.map.getCenter().lng + 90) / 360) * 360
    ]
  }
}

ee(OverpassLayer.prototype)

// to enable extending twig
OverpassLayer.twig = twig

module.exports = OverpassLayer
