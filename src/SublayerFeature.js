/* global L:false */
const DOMPurify = require('dompurify')
const styleToLeaflet = require('./styleToLeaflet')
const pointOnFeature = require('./pointOnFeature')
const twig = require('twig')
const strToStyle = require('./strToStyle')
const isTrue = require('./isTrue')

class SublayerFeature {
  constructor (object, sublayer) {
    this.object = object
    this.id = object.id
    this.sublayer = sublayer
    this.isShown = false
    this.flags = {}

    this.geometry = null

    if (this.object && this.object.on) {
      this.object.on('update', () => {
        this.geometry = null
      })
    }
  }

  updateFlags () {
    const shownFeatureOptions = this.sublayer.shownFeatureOptions[this.id]

    this.flags = {}
    shownFeatureOptions.forEach(options => {
      if (options.flags) {
        options.flags.forEach(flag => {
          this.flags[flag] = true
        })
      }
    })
  }

  processObject () {
    let k
    const ob = this.object
    const showOptions = {
      styles: []
    }
    const leafletFeatureOptions = {
      shiftWorld: this.sublayer.master.getShiftWorld()
    }

    if (ob.id in this.sublayer.shownFeatureOptions) {
      this.sublayer.shownFeatureOptions[ob.id].forEach(function (opt) {
        if ('styles' in opt) {
          showOptions.styles = showOptions.styles.concat(opt.styles)
        }
      })
    }

    const objectData = this.evaluate()

    if (!this.feature) {
      this.feature = ob.leafletFeature(Object.assign({
        weight: 0,
        opacity: 0,
        fillOpacity: 0,
        interactive: false,
        radius: 0
      }, leafletFeatureOptions))
    }

    for (k in objectData) {
      const m = k.match(/^style(|:(.*))$/)
      if (m) {
        const styleId = typeof m[2] === 'undefined' ? 'default' : m[2]
        const style = styleToLeaflet(objectData[k], this.sublayer.master.globalTwigData)

        if (!('attribution' in style)) {
          style.attribution = this.sublayer.options.attribution
        }

        if (this.features[styleId]) {
          this.features[styleId].setStyle(style)
        } else {
          this.features[styleId] = ob.leafletFeature(Object.assign(style, leafletFeatureOptions))
        }

        if ('text' in style && 'setText' in this.features[styleId]) {
          this.features[styleId].setText(null)
          this.features[styleId].setText(style.text, {
            repeat: style.textRepeat,
            center: style.textCenter,
            offset: style.textOffset,
            below: style.textBelow,
            attributes: {
              fill: style.textFill,
              'fill-opacity': style.textFillOpacity,
              'font-weight': style.textFontWeight,
              'font-size': style.textFontSize,
              'letter-spacing': style.textLetterSpacing
            }
          })
        }

        if ('offset' in style && 'setOffset' in this.features[styleId]) {
          this.features[styleId].setOffset(style.offset)
        }
      }
    }

    if ('styles' in showOptions) {
      objectData.styles = objectData.styles.concat(showOptions.styles)
    }

    objectData.marker = {
      html: '',
      iconAnchor: [0, 0],
      iconSize: [0, 0],
      signAnchor: [0, 0],
      popupAnchor: [0, 0]
    }
    if (objectData.markerSymbol) {
      objectData.marker.html += objectData.markerSymbol

      const div = document.createElement('div')
      div.innerHTML = DOMPurify.sanitize(objectData.markerSymbol, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_ATTR: ['anchorX', 'anchory', 'signanchorx', 'signanchory', 'popupanchorx', 'popupanchory']
      })

      if (div.firstChild) {
        const c = div.firstChild

        objectData.marker.iconSize = [c.offsetWidth, c.offsetHeight]
        if (c.hasAttribute('width')) {
          objectData.marker.iconSize[0] = parseFloat(c.getAttribute('width'))
        }
        if (c.hasAttribute('height')) {
          objectData.marker.iconSize[1] = parseFloat(c.getAttribute('height'))
        }

        objectData.marker.iconAnchor = [objectData.marker.iconSize[0] / 2, objectData.marker.iconSize[1] / 2]
        if (c.hasAttribute('anchorx')) {
          objectData.marker.iconAnchor[0] = parseFloat(c.getAttribute('anchorx'))
        }
        if (c.hasAttribute('anchory')) {
          objectData.marker.iconAnchor[1] = parseFloat(c.getAttribute('anchory'))
        }

        if (c.hasAttribute('signanchorx')) {
          objectData.marker.signAnchor[0] = parseFloat(c.getAttribute('signanchorx'))
        }
        if (c.hasAttribute('signanchory')) {
          objectData.marker.signAnchor[1] = parseFloat(c.getAttribute('signanchory'))
        }

        if (c.hasAttribute('popupanchorx')) {
          objectData.marker.popupAnchor[0] = parseFloat(c.getAttribute('popupanchorx'))
        }
        if (c.hasAttribute('popupanchory')) {
          objectData.marker.popupAnchor[1] = parseFloat(c.getAttribute('popupanchory'))
        }
      }

      this.sublayer.updateAssets(div, objectData)
    }

    if (objectData.markerSign) {
      const x = objectData.marker.iconAnchor[0] + objectData.marker.signAnchor[0]
      const y = -objectData.marker.iconSize[1] + objectData.marker.iconAnchor[1] + objectData.marker.signAnchor[1]
      objectData.marker.html += '<div class="sign" style="margin-left: ' + x + 'px; margin-top: ' + y + 'px;">' + DOMPurify.sanitize(objectData.markerSign) + '</div>'
    }

    const exclude = isTrue(objectData.exclude)

    if (objectData.marker.html) {
      objectData.marker.className = 'overpass-layer-icon'
      const icon = L.divIcon(objectData.marker)

      if (this.featureMarker) {
        if (exclude) {
          this.map.removeLayer(this.featureMarker)
        } else {
          this.featureMarker.addTo(this.map)
        }

        this.featureMarker.setIcon(icon)
        if (this.featureMarker._icon) {
          this.sublayer.updateAssets(this.featureMarker._icon)
        }
      } else {
        if (!this.pointOnFeature) {
          this.pointOnFeature = pointOnFeature(ob, leafletFeatureOptions)
        }

        if (this.pointOnFeature) {
          this.featureMarker = L.marker(this.pointOnFeature, { icon: icon })
        }
      }
    }

    if (exclude) {
      objectData.styles = []
    }

    if (this.isShown) {
      this.feature.addTo(this.sublayer.map)
      for (k in this.features) {
        if (objectData.styles && objectData.styles.indexOf(k) !== -1 && this.styles && this.styles.indexOf(k) === -1) {
          this.features[k].addTo(this.sublayer.map)
        }
        if (objectData.styles && objectData.styles.indexOf(k) === -1 && this.styles && this.styles.indexOf(k) !== -1) {
          this.sublayer.map.removeLayer(this.features[k])
        }
      }
    }
    this.styles = objectData.styles

    this.layouts = {}
    for (const k in this.sublayer.options.layouts) {
      if (typeof this.sublayer.options.layouts[k] === 'function') {
        this.layouts[k] = this.sublayer.options.layouts[k]({ object: objectData })
      } else {
        this.layouts[k] = this.sublayer.options.layouts[k]
      }
    }

    const popupContent = DOMPurify.sanitize(this.layouts.popup)

    if (this.popup) {
      if (this.popup.currentHTML && (popupContent !== null || this.popup.currentHTML !== popupContent)) {
        this.popup._contentNode.innerHTML = popupContent
        this.popup.currentHTML = popupContent
        this.sublayer.updateAssets(this.popup._contentNode, objectData)
      }
    } else {
      this.popup = L.popup()
      this.popup.object = this
      this.popup.sublayer = this.sublayer

      // do not set content here, but later, when _popupOpen gets called
      this.popup.currentHTML = null

      this.feature.bindPopup(this.popup)
      for (k in this.features) {
        if (this.sublayer._shallBindPopupToStyle(k)) {
          this.features[k].bindPopup(this.popup)
        }
      }

      if (this.featureMarker) {
        this.featureMarker.bindPopup(this.popup)
      }
    }

    this.id = ob.id
    this.layer_id = this.sublayer.options.id
    this.sublayer_id = this.sublayer.options.sublayer_id
    this.data = objectData

    if (this.sublayer.master.onUpdate) {
      this.sublayer.master.onUpdate(this)
    }

    this.sublayer.master.emit('update', this.object, this)
    this.sublayer.emit('update', this.object, this)
  }

  _popupOpen (e) {
    const popupContent = DOMPurify.sanitize(this.layouts.popup)

    if (popupContent !== null) {
      e.popup.setContent(popupContent)
      e.popup.currentHTML = popupContent
    }
  }

  _popupClose (e) {
    e.popup.currentHTML = null
  }

  evaluate () {
    this.twigData = this.compileTwigData()

    global.currentMapFeature = this
    const objectData = {}
    for (const k in this.sublayer.options.feature) {
      if (typeof this.sublayer.options.feature[k] === 'function') {
        objectData[k] = this.sublayer.options.feature[k](this.twigData)
      } else {
        objectData[k] = this.sublayer.options.feature[k]
      }
    }
    delete global.currentMapFeature

    const styleIds = []
    for (const k in objectData) {
      const m = k.match(/^style(|:(.*))$/)
      if (m) {
        const style = objectData[k]
        const styleId = typeof m[2] === 'undefined' ? 'default' : m[2]

        if (typeof style === 'string' || 'twig_markup' in style) {
          objectData[k] = strToStyle(style)
        }

        if (this.sublayer.options.stylesNoAutoShow.indexOf(styleId) === -1) {
          styleIds.push(styleId)
        }
      }
    }

    if (!('features' in this)) {
      this.features = {}
    }

    objectData.styles =
      'styles' in objectData
        ? objectData.styles
        : 'styles' in this.sublayer.options
          ? this.sublayer.options.styles
          : styleIds
    if (typeof objectData.styles === 'string' || 'twig_markup' in objectData.styles) {
      const styles = objectData.styles.trim()
      if (styles === '') {
        objectData.styles = []
      } else {
        objectData.styles = styles.split(/,/).map(style => style.trim())
      }
    }

    return objectData
  }

  compileTwigData () {
    const ob = this.object

    const result = {
      id: ob.id,
      sublayer_id: this.sublayer.options.sublayer_id,
      osm_id: ob.osm_id,
      type: ob.type,
      tags: ob.tags,
      meta: ob.meta,
      flags: this.flags,
      members: [],
      const: this.sublayer.options.const
    }

    if (ob.geometry) {
      if (!this.geometry) {
        this.geometry = twig.filters.raw(JSON.stringify(ob.GeoJSON().geometry))
      }
      result.geometry = this.geometry
    }

    if (ob.memberFeatures) {
      ob.memberFeatures.forEach((member, sequence) => {
        const r = {
          id: member.id,
          sequence,
          type: member.type,
          osm_id: member.osm_id,
          role: ob.members[sequence].role,
          tags: member.tags,
          meta: member.meta,
          dir: member.dir,
          connectedPrev: member.connectedPrev,
          connectedNext: member.connectedNext
        }

        result.members.push(r)
      })
    }

    for (const k in this.sublayer.master.globalTwigData) {
      result[k] = this.sublayer.master.globalTwigData[k]
    }

    this.sublayer.emit('twigData', ob, this, result)
    this.sublayer.master.emit('twigData', ob, this, result)

    return result
  }

  show () {
    if (!this.sublayer.map) {
      return
    }

    this.map = this.sublayer.map

    this.feature.addTo(this.map)
    for (let i = 0; i < this.styles.length; i++) {
      const k = this.styles[i]
      if (k in this.features) {
        this.features[k].addTo(this.map)
      }
    }

    if (this.featureMarker && !isTrue(this.data.exclude)) {
      this.featureMarker.addTo(this.map)
      this.sublayer.updateAssets(this.featureMarker._icon)
    }

    this.object.on('update', this.sublayer.scheduleReprocess.bind(this.sublayer, this.id))

    this.isShown = true
  }

  hide () {
    this.sublayer.master.emit('remove', this.object, this)
    this.sublayer.emit('remove', this.object, this)

    this.map.removeLayer(this.feature)
    for (const k in this.features) {
      this.map.removeLayer(this.features[k])
    }

    if (this.featureMarker) {
      this.map.removeLayer(this.featureMarker)
    }

    if (this.sublayer.master.onDisappear) {
      this.sublayer.master.onDisappear(this)
    }

    this.object.off('update', this.sublayer.scheduleReprocess.bind(this.sublayer, this.id))

    this.isShown = false
  }

  recalc () {
    this.sublayer.scheduleReprocess(this.id)
  }
}

module.exports = SublayerFeature
