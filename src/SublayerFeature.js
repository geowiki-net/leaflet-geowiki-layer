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
    this.features = {}

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
    this.leafletFeatureOptions = {
      shiftWorld: this.sublayer.master.getShiftWorld()
    }

    if (ob.id in this.sublayer.shownFeatureOptions) {
      this.sublayer.shownFeatureOptions[ob.id].forEach(function (opt) {
        if ('styles' in opt) {
          showOptions.styles = showOptions.styles.concat(opt.styles)
        }
      })
    }

    this.twigData = this.compileTwigData()
    this._objectData = {}
    this.renderFeatureValue('pre')

    if (!this.feature) {
      this.feature = ob.leafletFeature(Object.assign({
        weight: 0,
        opacity: 0,
        fillOpacity: 0,
        interactive: false,
        radius: 0
      }, this.leafletFeatureOptions))
    }

    this._applyMarker()

    let styles = this.renderFeatureValue('styles')
    if (!styles) {
      styles = 'styles' in this.sublayer.options ? this.sublayer.options.styles : this.sublayer.autoStyles
    }

    if ('styles' in showOptions) {
      styles = styles.concat(showOptions.styles)
    }

    const exclude = isTrue(this.renderFeatureValue('exclude'))
    if (exclude) {
      styles = []
    }

    if (this.isShown) {
      this.feature.addTo(this.sublayer.map)

      styles.forEach(styleId => {
        const k = styleId === 'default' ? 'style' : ('style:' + styleId)
        this._applyFeature(k)
        this.features[styleId].addTo(this.sublayer.map)
      })

      for (k in this.features) {
        if (styles && styles.indexOf(k) === -1 && this.styles && this.styles.indexOf(k) !== -1) {
          this.sublayer.map.removeLayer(this.features[k])
        }
      }
    }
    this.styles = styles

    this._applyPopup()

    this.id = ob.id
    this.layer_id = this.sublayer.options.id
    this.sublayer_id = this.sublayer.options.sublayer_id

    if (this.sublayer.master.onUpdate) {
      this.sublayer.master.onUpdate(this)
    }

    this.sublayer.master.emit('update', this.object, this)
    this.sublayer.emit('update', this.object, this)
  }

  _applyFeature (k) {
    const styleId = k === 'style' ? 'default' : k.substr(6)
    let data = this.renderFeatureValue(styleId === 'default' ? ['style:default', 'style'] : k)

    if (typeof data === 'string' || 'twig_markup' in data) {
      data = strToStyle(data)
    }

    const style = styleToLeaflet(data, this.sublayer.master.globalTwigData)

    if (!('attribution' in style)) {
      style.attribution = this.sublayer.options.attribution
    }

    if (this.features[styleId]) {
      this.features[styleId].setStyle(style)
    } else {
      this.features[styleId] = this.object.leafletFeature(Object.assign(style, this.leafletFeatureOptions))
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

  _applyMarker () {
    const ob = this.object

    const marker = {
      html: '',
      iconAnchor: [0, 0],
      iconSize: [0, 0],
      signAnchor: [0, 0],
      popupAnchor: [0, 0]
    }

    const markerSymbol = this.renderFeatureValue('markerSymbol')
    if (markerSymbol) {
      marker.html += markerSymbol

      const div = document.createElement('div')
      div.innerHTML = DOMPurify.sanitize(markerSymbol, {
        ADD_ATTR: ['anchorx', 'anchory', 'signanchorx', 'signanchory', 'popupanchorx', 'popupanchory']
      })

      if (div.firstChild) {
        const c = div.firstChild

        marker.iconSize = [c.offsetWidth, c.offsetHeight]
        if (c.hasAttribute('width')) {
          marker.iconSize[0] = parseFloat(c.getAttribute('width'))
        }
        if (c.hasAttribute('height')) {
          marker.iconSize[1] = parseFloat(c.getAttribute('height'))
        }

        marker.iconAnchor = [marker.iconSize[0] / 2, marker.iconSize[1] / 2]
        if (c.hasAttribute('anchorx')) {
          marker.iconAnchor[0] = parseFloat(c.getAttribute('anchorx'))
        }
        if (c.hasAttribute('anchory')) {
          marker.iconAnchor[1] = parseFloat(c.getAttribute('anchory'))
        }

        if (c.hasAttribute('signanchorx')) {
          marker.signAnchor[0] = parseFloat(c.getAttribute('signanchorx'))
        }
        if (c.hasAttribute('signanchory')) {
          marker.signAnchor[1] = parseFloat(c.getAttribute('signanchory'))
        }

        if (c.hasAttribute('popupanchorx')) {
          marker.popupAnchor[0] = parseFloat(c.getAttribute('popupanchorx'))
        }
        if (c.hasAttribute('popupanchory')) {
          marker.popupAnchor[1] = parseFloat(c.getAttribute('popupanchory'))
        }
      }

      // TODO - updateAssets changed parameters, update dependents
      this.sublayer.updateAssets(div, this.object, this)
    }

    const markerSign = this.renderFeatureValue('markerSign')
    if (markerSign) {
      const x = marker.iconAnchor[0] + marker.signAnchor[0]
      const y = -marker.iconSize[1] + marker.iconAnchor[1] + marker.signAnchor[1]
      marker.html += '<div class="sign" style="margin-left: ' + x + 'px; margin-top: ' + y + 'px;">' + DOMPurify.sanitize(markerSign) + '</div>'
    }

    const exclude = isTrue(this.renderFeatureValue('exclude'))

    if (marker.html) {
      marker.className = 'overpass-layer-icon'
      const icon = L.divIcon(marker)

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
          this.pointOnFeature = pointOnFeature(ob, this.leafletFeatureOptions)
        }

        if (this.pointOnFeature) {
          this.featureMarker = L.marker(this.pointOnFeature, { icon: icon })
        }
      }
    }
  }

  _applyPopup () {
    if (this.popup) {
      const popupContent = DOMPurify.sanitize(this.renderLayout('popup'))

      if (this.popup.currentHTML && (popupContent !== null || this.popup.currentHTML !== popupContent)) {
        this.popup._contentNode.innerHTML = popupContent
        this.popup.currentHTML = popupContent
        // TODO - updateAssets changed parameters, update dependents
        this.sublayer.updateAssets(this.popup._contentNode, this.object, this)
      }
    } else {
      this.popup = L.popup()
      this.popup.object = this
      this.popup.sublayer = this.sublayer

      // do not set content here, but later, when _popupOpen gets called
      this.popup.currentHTML = null

      this.feature.bindPopup(this.popup)
      for (const k in this.features) {
        if (this.sublayer._shallBindPopupToStyle(k)) {
          this.features[k].bindPopup(this.popup)
        }
      }

      if (this.featureMarker) {
        this.featureMarker.bindPopup(this.popup)
      }
    }
  }

  /**
   * render a property of the 'feature' definition.
   *
   * @param {string|string[]} key The key of the feature description to be rendered (e.g. 'title'). If an array is passed, the first found layout will be rendered.
   * @return {string|null} Return the result or null of no renderable key has been found.
   */
  renderFeatureValue (key) {
    if (Array.isArray(key)) {
      key = key.find(k => this.sublayer.options.feature[k])
    }

    if (!key) {
      return null
    }

    if (key in this._objectData) {
      return this._objectData[key]
    }

    const template = this.sublayer.options.feature[key]

    if (typeof template === 'function') {
      global.currentMapFeature = this
      this._objectData[key] = template(this.twigData)
      delete global.currentMapFeature
    } else {
      this._objectData[key] = template
    }

    return this._objectData[key]
  }

  /**
   * @param {string|string[]} k Layout ID to be rendered. If an array is passed, the first found layout will be rendered.
   * @return {string|null} Return the result or null of no renderable layout has been found.
   */
  renderLayout (k) {
    if (Array.isArray(k)) {
      for (let i = 0; i < k.length; i++) {
        const r = this.renderLayout(k[i])
        if (r) {
          return r
        }
      }

      return null
    }

    const handler = {
      get (target, prop, receiver) {
        if (prop.match(/^get/)) {
          const key = prop[3].toLowerCase() + prop.substr(4)
          return target.renderFeatureValue(key)
        }
      }
    }

    if (typeof this.sublayer.options.layouts[k] === 'function') {
      return this.sublayer.options.layouts[k]({ object: new Proxy(this, handler) })
    }

    return this.sublayer.options.layouts[k]
  }

  _popupOpen (e) {
    const popupContent = DOMPurify.sanitize(this.renderLayout('popup'))

    if (popupContent !== null) {
      e.popup.setContent(popupContent)
      e.popup.currentHTML = popupContent
    }
  }

  _popupClose (e) {
    e.popup.currentHTML = null
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

    this.styles.forEach(styleId => {
      const k = styleId === 'default' ? 'style' : ('style:' + styleId)
      this._applyFeature(k)
      this.features[styleId].addTo(this.map)
    })

    if (this.featureMarker && !isTrue(this.renderFeatureValue('exclude'))) {
      this.featureMarker.addTo(this.map)
      // TODO - updateAssets changed parameters, update dependents
      this.sublayer.updateAssets(this.featureMarker._icon, this.object, this)
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
