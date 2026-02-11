const GeowikiAPI = require('@geowiki-net/geowiki-api')

const OverpassLayer = require('./src/OverpassLayer')
const OverpassLayerList = require('./src/OverpassLayerList')

if (typeof window !== 'undefined') {
  window.OverpassLayer = OverpassLayer
  window.OverpassLayerList = OverpassLayerList
  window.OverpassFrontend = GeowikiAPI // compatibility old software
  window.GeowikiAPI = GeowikiAPI
}

OverpassLayer.List = OverpassLayerList
module.exports = OverpassLayer
