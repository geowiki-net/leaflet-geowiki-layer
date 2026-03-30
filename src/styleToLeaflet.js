const isTrue = require('./isTrue')
const geoFunctions = require('@geowiki-net/geowiki-lib-geo-functions')

const transforms = {
  stroke: {
    type: 'boolean'
  },
  color: {
    type: 'color'
  },
  fill: {
    type: 'boolean'
  },
  fillColor: {
    type: 'color'
  },
  text: {
    type: 'string'
  },
  textFill: {
    type: 'color'
  },
  textRepeat: {
    type: 'boolean'
  },
  textBelow: {
    type: 'boolean'
  },
  textOffset: {
    type: 'float'
  },
  textCenter: {
    type: 'boolean'
  },
  textFillOpacity: {
    type: 'float'
  },
  textFontWeight: {
    type: 'string'
  },
  textFontSize: {
    type: 'string'
  },
  textLetterSpacing: {
    type: 'float'
  },
  noClip: {
    type: 'boolean'
  },
  width: {
    rename: 'weight',
    type: 'length'
  },
  opacity: {
    type: 'float'
  },
  lineCap: {
    type: 'string'
  },
  lineJoin: {
    type: 'string'
  },
  fillOpacity: {
    type: 'float'
  },
  fillRule: {
    type: 'string'
  },
  radius: {
    type: 'float'
  },
  bubblingMouseEvents: {
    type: 'boolean'
  },
  interactive: {
    type: 'boolean'
  },
  pane: {
    type: 'string'
  },
  attribution: {
    type: 'string'
  },
  smoothFactor: {
    type: 'float'
  },
  offset: {
    type: 'length'
  },
  dashArray: {
    type: 'multiple-length'
  },
  dashOffset: {
    type: 'length'
  },
  zIndex: {
    type: 'float'
  }
}

function styleToLeaflet (style, twigData) {
  const ret = JSON.parse(JSON.stringify(style))

  for (let k in ret) {
    let value = ret[k]

    if (k in transforms) {
      const transform = transforms[k]

      switch (transform.type) {
        case 'boolean':
          value = isTrue(ret[k])
          break
        case 'float':
          value = parseFloat(ret[k])
          break
        case 'length':
          if (twigData && twigData.map) {
            value = geoFunctions.parseLength(ret[k], twigData.map)
          } else {
            value = parseFloat(ret[k])
          }
          break
        case 'multiple-length':
          value = ret[k].split(/,/g).map(v => geoFunctions.parseLength(v, twigData.map)).join(',')
      }

      if (transform.rename) {
        delete ret[k]
        k = transform.rename
      }
    }

    ret[k] = value
  }

  return ret
}

module.exports = styleToLeaflet
