/* eslint-disable new-cap */
const nearestPointOnGeometry = require('nearest-point-on-geometry')
const BoundingBox = require('boundingbox')

const _Sublayer = require('@geowiki-net/geowiki-layer/src/Sublayer')
const SublayerFeature = require('./SublayerFeature')

// Extensions:
const extensions = [
  require('./DecoratorPattern')
]

class Sublayer extends _Sublayer {
  constructor (master, options) {
    super(master, options)
    this.featureClass = SublayerFeature

    extensions.forEach(Ext => new Ext(this))
  }

  addTo (map) {
    this.map = map

    this.map.on('popupopen', this._popupOpen.bind(this))
    this.map.on('popupclose', this._popupClose.bind(this))
  }

  _popupOpen (e) {
    if (e.popup.sublayer === this) {
      const ob = e.popup.object

      ob._popupOpen(e)

      this.emit('selectObject', ob.object, ob)
      this.master.emit('selectObject', ob.object, ob)

      this.updateAssets(e.popup._contentNode)
    }
  }

  _popupClose (e) {
    if (e.popup.sublayer === this) {
      const ob = e.popup.object

      ob._popupClose(e)

      this.emit('unselectObject', ob.object, ob)
      this.master.emit('unselectObject', ob.object, ob)
    }
  }

  remove () {
  }

  reorder () {
    if (!this._initiateReorder) {
      this._initiateReorder = global.setTimeout(() => this._reorder(), 0)
    }
  }

  _reorder () {
    delete this._initiateReorder
    const allFeatureFeatures = Object.values(this.visibleFeatures)
      .map(f => Object.values(f.features))
      .flat()

    // send all negative zIndex features to the back
    allFeatureFeatures.filter(f => (f.options.zIndex ?? 0) < 0)
      .sort((a, b) => (b.options.zIndex ?? 0) - (a.options.zIndex ?? 0))
      .forEach(f => f.bringToBack())

    // send all positive zIndex features to the front
    allFeatureFeatures.filter(f => (f.options.zIndex ?? 0) > 0)
      .sort((a, b) => (a.options.zIndex ?? 0) - (b.options.zIndex ?? 0))
      .forEach(f => f.bringToFront())
  }

  _shallBindPopupToStyle (styleId) {
    return this.options.styleNoBindPopup.indexOf(styleId) === -1
  }

  openPopupOnObject (ob, options) {
    if (typeof ob === 'string') {
      return this.get(ob, options, (err, ob) => {
        if (err) {
          return console.log(err)
        }

        ob.processObject()
        ob.show()
        this.openPopupOnObject(ob, options)
      })
    }

    // Fix LeafletJS ^1.8. _source points to wrong object, so it won't open on
    // FeatureGroups (e.g. Multipolygons)
    ob.feature._popup._source = ob.feature

    // When object is quite smaller than current view, show popup on feature
    const viewBounds = new BoundingBox(this.map.getBounds())
    const obBounds = new BoundingBox(ob.object.bounds)
    if (obBounds.diagonalLength() * 0.75 < viewBounds.diagonalLength()) {
      return ob.feature.openPopup()
    }

    // otherwise, try to find point on geometry closest to center of view
    const pt = this.map.getCenter()
    const geom = ob.object.GeoJSON()
    let pos = nearestPointOnGeometry(geom, { type: 'Feature', geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] } })
    if (pos) {
      pos = pos.geometry.coordinates
      return ob.feature.openPopup([pos[1], pos[0]])
    }

    // no point found? use normal object popup open then ...
    ob.feature.openPopup()
  }

  /**
   * evaluate a fake object
   */
  evaluate (ob) {
    const feature = new SublayerFeature(ob, this)
    return feature.evaluate()
  }
}

module.exports = Sublayer
