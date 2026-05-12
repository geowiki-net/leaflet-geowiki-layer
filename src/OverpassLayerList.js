/* eslint camelcase: 0 */

require('./OverpassLayerList.css')

const DOMPurify = require('dompurify')
const isTrue = require('./isTrue')

class OverpassLayerList {
  constructor (layer, options) {
    // compatibility <1.0
    let parentDom
    if (arguments.length > 1 && arguments[1].constructor.name === 'OverpassLayer') {
      parentDom = arguments[0]
      layer = arguments[1]
      console.error('overpass-layer: class OverpassLayerList() accepts only one parameter, "layer"')
    }
    // end

    this.dom = document.createElement('ul')
    this.dom.className = 'overpass-layer-list'
    this.layer = Array.isArray(layer) ? layer : [layer]
    this.options = options || {}
    this.options.prefix = this.options.prefix || 'list'
    this.selectedId = null

    const prefix = this.options.prefix
    this.layer.forEach(layer => {
      if (!(prefix in layer.options.layouts)) {
        layer.setLayout(prefix,
          '<div class="marker">' +
          '{% if object.' + prefix + 'MarkerSymbol or object.markerSymbol %}' +
          '<div class="symbol">{{ object.' + prefix + 'MarkerSymbol|default(object.markerSymbol) }}</div>' +
          '{% elseif object.marker and object.marker.iconUrl %}' +
          '<img class="symbol" src="{{ object.marker.iconUrl|e }}">' +
          '{% endif %}' +
          '{% if object.' + prefix + 'MarkerSign or object.markerSign %}' +
          '<div class="sign">{{ object.' + prefix + 'MarkerSign|default(object.markerSign) }}</div>' +
          '{% endif %}' +
          '</div>' +
          '<div class="content">' +
          '<a class="title" href="{{ object.appUrl|default("#") }}">{{ object.' + prefix + 'Title|default(object.title) }}</a>' +
          '{% if object.' + prefix + 'Description or object.description %}<div class="description">{{ object.' + prefix + 'Description|default(object.description) }}</div>{% endif %}' +
          '</div>'
        )
      }
    })

    this.layer.forEach(layer => {
      layer.on('add', (ob, data) => this.addObject(data))
      layer.on('update', (ob, data) => this.updateObject(data))
      layer.on('remove', (ob, data) => this.delObject(data))
      layer.on('selectObject', (ob, data) => {
        this.selectedId = ob.id + ':' + ob.sublayer_id
        this.updateObject(data)
      })
      layer.on('unselectObject', (ob, data) => {
        this.selectedId = null
        this.updateObject(data)
      })
    })

    this.items = {}

    if (parentDom) {
      this.addTo(parentDom)
    }
  }

  addTo (parentDom) {
    parentDom.appendChild(this.dom)
  }

  addObject (ob) {
    const id = ob.id + ':' + ob.sublayer_id

    const listExclude = isTrue(ob.data[this.options.prefix + 'Exclude']) ||
      (!(this.options.prefix + 'Exclude' in ob.data) && isTrue(ob.data.exclude))

    if (listExclude) {
      return
    }

    if (id in this.items) { // already added
      return
    }

    const div = document.createElement('li')

    if (this.selectedId === id) {
      div.classList.add('selected')
    }

    this.items[id] = div
    ob[this.options.prefix + 'Item'] = div

    // CONTENT
    const html = DOMPurify.sanitize(ob.renderLayout([this.options.prefix, 'list']) || '')
    div.innerHTML = html
    div.currentHTML = html

    div.priority = 'priority' in ob.data ? parseFloat(ob.data.priority) : 0

    let current = this.dom.firstChild
    while (current && current.priority <= div.priority) {
      current = current.nextSibling
    }

    if (current) {
      this.dom.insertBefore(div, current)
    } else {
      this.dom.appendChild(div)
    }

    ob.sublayer.updateAssets(div, ob.data)

    div.onmouseover = function (id, sublayer_id) {
      if (this.currentHover) {
        this.currentHover.hide()
      }

      this.currentHover = ob.sublayer.show(id,
        {
          styles: ['hover'],
          flags: ['hover'],
          sublayer_id
        },
        () => {}
      )
    }.bind(this, ob.id, ob.sublayer_id)

    div.onmouseout = function (id, sublayer_id) {
      if (this.currentHover) {
        this.currentHover.hide()
      }

      this.currentHover = null
    }.bind(this, ob.id, ob.sublayer_id)

    div.onclick = function (ob) {
      ob.sublayer.master.openPopupOnObject(ob)
      return false
    }.bind(this, ob)
  }

  updateObject (ob) {
    const id = ob.id + ':' + ob.sublayer_id

    const listExclude = isTrue(ob.data[this.options.prefix + 'Exclude']) ||
      (!(this.options.prefix + 'Exclude' in ob.data) && isTrue(ob.data.exclude))

    if (!(id in this.items) && !listExclude) {
      return this.addObject(ob)
    }

    if (listExclude) {
      return this.delObject(ob)
    }

    const div = this.items[id]

    if (this.selectedId === id) {
      div.classList.add('selected')
    } else {
      div.classList.remove('selected')
    }

    // CONTENT
    const html = DOMPurify.sanitize(ob.renderLayout([this.options.prefix, 'list']) || '')
    if (div.currentHTML !== html) {
      div.innerHTML = html
      div.currentHTML = html
    }

    ob.sublayer.updateAssets(div, ob.data)
  }

  delObject (ob) {
    const id = ob.id + ':' + ob.sublayer_id

    const div = this.items[id]

    if (div) {
      this.dom.removeChild(div)
    }

    delete this.items[id]
    delete ob[this.options.prefix + 'Item']
  }

  remove () {
    while (this.dom.firstChild) {
      this.dom.removeChild(this.dom.lastChild)
    }

    for (const k in this.items) {
      delete this.items[k][this.options.prefix + 'Item']
    }

    this.items = {}
  }
}

module.exports = OverpassLayerList
