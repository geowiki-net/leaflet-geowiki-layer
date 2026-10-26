const compileTemplate = require('./compileTemplate')

function compileFeature (feature, twig, options = {}) {
  if (!('autoescape' in options)) {
    options.autoescape = true
  }

  if (typeof feature === 'string') {
    if (feature.search('{') !== -1) {
      feature = compileTemplate(feature, twig, options)
    }

    return feature
  }

  for (const k in feature) {
    if (typeof feature[k] === 'string' && feature[k].search('{') !== -1) {
      feature[k] = compileTemplate(feature[k], twig, options)
    } else if (typeof feature[k] === 'object' && (['style'].indexOf(k) !== -1 || k.match(/^style:/))) {
      const templates = {}
      for (const k1 in feature[k]) {
        if (typeof feature[k][k1] === 'string' && feature[k][k1].search('{') !== -1) {
          try {
            templates[k1] = twig.twig({ data: feature[k][k1], autoescape: options.autoescape, rethrow: true })
          } catch (e) {
            console.error("Can't compile template:\n" + feature[k][k1] + '\n\n', e.message)
          }
        } else {
          templates[k1] = feature[k][k1]
        }
      }

      feature[k] = function (templates, ob) {
        const ret = {}
        for (const k1 in templates) {
          if (typeof templates[k1] === 'object' && templates[k1] !== null && 'render' in templates[k1]) {
            ret[k1] = templates[k1].render(ob)
          } else {
            ret[k1] = templates[k1]
          }
        }
        return ret
      }.bind(this, templates)
    }
  }

  return feature
}

module.exports = compileFeature
