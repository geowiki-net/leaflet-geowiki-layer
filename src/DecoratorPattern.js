/* global L */

const isTrue = require('@geowiki-net/geowiki-layer/src/isTrue')
const styleToLeaflet = require('./styleToLeaflet')
const geoFunctions = require('@geowiki-net/geowiki-lib-geo-functions')

class DecoratorPattern {
  constructor (layer) {
    this.layer = layer

    if (L.polylineDecorator) {
      this.layer.on('update', this.processObject.bind(this))
      this.layer.on('remove', this.removeObject.bind(this))
    }
  }

  parseType (key, value, twigData) {
    switch (key) {
      case 'polygon':
      case 'rotate':
        return isTrue(value)
      case 'pixelSize':
      case 'repeat':
      case 'offset':
      case 'endOffset':
      case 'lineOffset':
        return geoFunctions.parseLength(value, twigData.map)
      case 'angleCorrection':
      case 'headAngle':
        return parseFloat(value)
      default:
        return value
    }
  }

  processObject (object, data) {
    if (!data.patternFeatures) {
      data.patternFeatures = {}
    }

    Object.entries(data.getStyles()).forEach(([styleId, def]) => {
        const patternTypes = {}
        const patternOptions = []
        const symbolOptions = {}

        for (const k in def) {
          const m = k.match(/^pattern([^-]*)$/)
          if (m) {
            patternTypes[m[1]] = def[k]
            patternOptions[m[1]] = {}
            symbolOptions[m[1]] = {}
          }
        }

        for (const k in def) {
          const m1 = k.match(/^pattern([^-]*)-path-(.*)$/)
          const m2 = k.match(/^pattern([^-]*)-(.*)$/)

          if (m1) {
            symbolOptions[m1[1]][m1[2]] = def[k]
          } else if (m2) {
            patternOptions[m2[1]][m2[2]] = this.parseType(m2[2], def[k], data.twigData)
          }
        }

        const patternIds = Object.keys(patternTypes)
        const patterns = []
        patternIds.forEach(patternId => {
          let symbol
          const options = patternOptions[patternId]
        console.log(patternTypes[patternId], options)

          switch (patternTypes[patternId]) {
            case 'dash':
              options.pathOptions = styleToLeaflet(symbolOptions[patternId], data.twigData)
              symbol = L.Symbol.dash(options)
              break
            case 'streak':
              options.pathOptions = styleToLeaflet(symbolOptions[patternId], data.twigData)
              symbol = L.Symbol.streak(options)
              break
            case 'arrowHead':
              options.pathOptions = styleToLeaflet(symbolOptions[patternId], data.twigData)
              symbol = L.Symbol.arrowHead(options)
              break
            case 'marker':
              options.markerOptions = symbolOptions[patternId]
              symbol = L.Symbol.marker(options)
              break
            default:
              // TODO
          }

          if (symbol) {
            patternOptions[patternId].symbol = symbol
            patterns.push(patternOptions[patternId])
          }
        })

        if (!data.patternFeatures[styleId]) {
          data.patternFeatures[styleId] = L.polylineDecorator(data.features[styleId])
          data.patternFeatures[styleId].addTo(this.layer.map)
        }

        data.patternFeatures[styleId].setPatterns(patterns)

        if (this.layer._shallBindPopupToStyle(styleId)) {
          data.patternFeatures[styleId].bindPopup(data.popup)
        }
      })
//    else {
//        if (data.patternFeatures[k]) {
//          this.layer.map.removeLayer(data.patternFeatures[k])
//          delete data.patternFeatures[k]
//        }
//      }
//    })
  }

  removeObject (object, data) {
    if (!data.patternFeatures) {
      return
    }

    for (const k in data.features) {
      if (data.patternFeatures[k]) {
        this.layer.map.removeLayer(data.patternFeatures[k])
        delete data.patternFeatures[k]
      }
    }
  }
}

module.exports = DecoratorPattern
