/* eslint camelcase: 0 */
require('./OverpassLayer.css')

const BoundingBox = require('boundingbox')
const geoFunctions = require('@geowiki-net/geowiki-lib-geo-functions')
const GeowikiLayer = require('@geowiki-net/geowiki-layer/src/OverpassLayer')
const Sublayer = require('./Sublayer')
const Memberlayer = require('./Memberlayer')

class OverpassLayer extends GeowikiLayer {
  installClasses () {
    this.classes.Mainlayer = Sublayer
    this.classes.Memberlayer = Memberlayer
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

  remove () {
    super.remove()

    this.map.off('moveend', this.check_update_map, this)
    this.map = null
  }

  calcGlobalTwigData () {
    const center = this.map.getCenter()
    this.globalTwigData = {
      map: {
        zoom: this.map.getZoom(),
        center: { lat: center.lat, lon: center.lng }
      }
    }
    geoFunctions.metersPerPixel(this.globalTwigData.map)

    this.emit('globalTwigData', this.globalTwigData)
  }

  check_update_map () {
    console.log('check_update_map')
    if (!this.map || !this.map._loaded) {
      return
    }

    this.moveTo({
      bounds: new BoundingBox(this.map.getBounds()),
      zoom: this.map.getZoom()
    }, () => {})
  }

  recalc () {
    if (!this.map || !this.map._loaded) {
      return
    }

    super.recalc()
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

module.exports = OverpassLayer
