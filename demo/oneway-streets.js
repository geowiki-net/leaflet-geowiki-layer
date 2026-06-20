const overpassLayer = new OverpassLayer({
  query: 'way[highway][oneway][highway!=cycleway];',
  feature: {
    pre: "{% set oneway = 0 %}{% if tags.oneway in [ 'yes', '1' ] %}{% set oneway = 1 %}{% elseif tags.oneway in [ '-1' ] %}{% set oneway = -1 %}{% endif %}",
    markerSymbol: null,
    styles: "default{% if attribute(tags, 'oneway:bicycle') == 'no' %},cycle{% endif %}",
    style: {
      width: 0,
      pattern: 'arrowHead',
      'pattern-offset': '{% if oneway == -1 %}24{% else %}17{% endif %}',
      'pattern-repeat': 25,
      'pattern-polygon': true,
      'pattern-pixelSize': 9,
      'pattern-path-color': '#000000',
      'pattern-path-width': 1,
      'pattern-path-fillOpacity': 1,
      'pattern-angleCorrection': '{% if oneway == -1 %}180{% else %}0{% endif %}'
    },
    'style:cycle': {
      width: 0,
      pattern: 'arrowHead',
      'pattern-offset': '{% if oneway == -1 %}17{% else %}24{% endif %}',
      'pattern-repeat': 25,
      'pattern-polygon': true,
      'pattern-pixelSize': 9,
      'pattern-path-color': '#00ff00',
      'pattern-path-width': 1,
      'pattern-path-fillOpacity': 1,
      'pattern-angleCorrection': '{% if oneway == -1 %}0{% else %}180{% endif %}'
    }
  }
})
overpassLayer.addTo(map)
