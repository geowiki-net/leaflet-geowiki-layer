const OverpassLayer = require('./src/OverpassLayer')
const OverpassLayerList = require('./src/OverpassLayerList')

if (typeof window !== 'undefined') {
  window.OverpassLayer = OverpassLayer
  window.OverpassLayerList = OverpassLayerList
}

OverpassLayer.List = OverpassLayerList
module.exports = OverpassLayer
