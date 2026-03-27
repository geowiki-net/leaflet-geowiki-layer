# overpass-layer
Show a [Leaflet](https://leafletjs.com) layer using OpenStreetMap data from [Overpass API](https://overpass-api.de/) via [overpass-frontend](https://github.com/plepe/overpass-frontend).

Check the [Demos](http://xover.mud.at/~skunk/overpass-layer/)
and how to [set them up](./INSTALL.md).

# Usage
```js
// Connect to Overpass API - you can also use a (small) .osm file as data source
var overpassFrontend = new OverpassFrontend('//overpass-api.de/api/interpreter')

// Create the layer
var layer = new OverpassLayer({
  overpassFrontend: overpassFrontend,
  query: 'nwr[building]',
  minZoom: 16,
  feature: {
    title: '{{ tags.name }}',
    style: { width: 1, color: 'black' }
  }
})

// Create a LeafletJS map
var map = L.map('map').setView([ 51.5, 0.0 ], 16)

// Add the layer to the map
layer.addTo(map)
// ... or use a control
//var layerControl = L.control({}, { 'Buildings': layer })
//layerControl.addTo(map)
```

# API
## constructor OverpassLayer(options)
Create a Layer with an Overpass query and optional options.

Options:
* id: an optional id, which will be passed as `sublayer_id` to twig templates (see below).
* query: e.g. `node[natural=tree];`. Combine queries with: `(way[building];relation[building];);`. Optionally zoom-dependend queries can be given by using an object with the minimum zoom level as index, e.g. `{ 13: 'way[landuse=forest]', 15: '(way[landuse=forest];node[natural=tree];)' }`: zoom levels 13 and 14 all forests will be shown, from zoom level 15 all forests and trees.
* overpassFrontend: An OverpassFrontend object (defaults to the global variable `overpassFrontend`)
* attribution: a HTML string with attribution information
* minZoom: Show layer only from the given zoom level (default: 16)
* maxZoom: Show layer only up to the given zoom level (default: no limit)
* bounds: Show only items intersecting this GeoJSON polygon/multipolygon (default: `null`).
* styles: Array of style-id which should be shown. Default: `['default']`. May be overridden by a feature dependant styles array. Can be a comma-separated string.
* updateAssets: a function which will be called for all map feature specific HTML contexts. It can be used to update URLs of imgs. It will be passed the following parameters: domNode (the node which should be updated), objectData (data of the map feature), layer (the layer object).
* feature: an object describing how the feature will be formated resp. styled. Each of the values may be either a function which will be passed an OverpassObject or a string which will be processed with the templating language TwigJS:
  * styles: Array of style-id which should be shown. If not set, the value of the parent 'styles' values will be used. Can be a comma-separated string.
  * style: An object or a function or a TwigJS template (string), styling the resulting map feature (see below for a list of available parameters). Style-Id: "default".
    * If an object is used, e.g.: { width: 2, fillColor: 'red' }
    * A JSON string, e.g. `{"width":2,"fillColor":"red"}`.
    * If a function is used, the function will be passed the OverpassObject object and should return the style as object.
    * If a TwigJS template is used, the template should create lines with "key: value" (E.g. `color: red\nwidth: 2`) or a JSON string (e.g. `{"color":"red","width":2}` - if you use the `json_encode` filter, disable autoescape or use the raw filter (e.g. `{{ {"width":2}|json_encode|raw }}`). See below for possible patterns.
  * "style:*": Additional styles with the style-id as suffix (e.g. "style:casing"). (see below for a list of available parameters)
  * title: the title of the feature popup and the object in the list.
  * body: the body of the feature popup.
  * description: a short description shown in the list (or in the popup).
  * popupDescription: a short description shown in the popup (when undefined, use 'description').
  * markerSymbol: a HTML string which will be shown as marker. The first dom node may contain 'width', 'height' (iconSize), 'anchorX', 'anchorY' (iconAnchor), 'popupAnchorX', 'popupAnchorY' (popupAnchor), 'signAnchorX', 'signAnchorY' (anchor for markerSign) properties to override the default marker.anchor property.
  * markerSign: a HTML string which will be shown within the icon.
  * priority: a numeric value by which the elements in the list will be sorted (lower values first)
  * appUrl: an url for the link of an item in the list, default: '#'.
  * exclude: if value evaluates to true, will not be shown on the map (and the list)
  * listExclude: if value evaluates to true, will not be shown in the list (priority over exclude)
* queryOptions: options for OverpassFrontend.BBoxQuery.
* styleNoBindPopup: array, list of styles where popup should not bind to. Default: []
* stylesNoAutoShow: array, list of styles which should not automatically be shown.

* The following feature properties define behaviour in lists. Default prefix is 'list':
  * <prefix>Exclude: (boolean) If true, object will not be shown in the list.
* const: an object variable which is available as prefix in twig functions. See below.
  * <prefix>Title: the title of the object in the list (override 'title')
  * <prefix>MarkerSign: a HTML string which will be shown within the icon in the list (default: value of 'markerSign').
  * <prefix>MarkerSign: a HTML string which will be shown within the icon in the list (default: value of 'markerSign').
  * <prefix>Description: a HTML string which will be shown as description shown in the list (default: value of 'description').

### Style options
Without extensions installed, the following style parameters are available:

Parameter | Type | Default | Remarks
----------|------|---------|---------
stroke    | boolean | true
color     | color  | #3388ff
width     | length | 3
opacity   | float  | 1.0
lineCap   | string | round
lineJoin  | string | round
dashArray | mutiple values of length | ''
dashOffset | length | ''
fill      | boolean | depends
fillColor | color  | depends
fillOpacity | float | 0.2
fillRule  | string | 'evenodd'
radius       | float | depends | Circle and CircleMarker only
bubblingMouseEvents | boolean | true
interactive | boolean | true
pane      | string | 'overlayPane'
attribution | string | null | Override default attribution
smoothFactor | float | 1.0 | Polyline only
zIndex | float | 0.0 | Order of features (higher = front). This is not very efficient, using 'pane' is faster.

Types:
* boolean: true or false. The following values are false: `undefined`, `null`, `false`, "false", 0, "0", "".
* color: A CSS color value, e.g. "#f00", "#ff0000", "#ff0000ff", "rgb(255, 0, 0)", rgb(255, 0, 0, 1), "red", ...
* float: a number, e.g. `1`, `0.5`.
* string: an arbitrary text.
* length: a number with an optional unit. Availble units: 'px' (default, a distance in display pixels), 'm' (meters in world coordinate system), '%' (percentage of total length - if supported)

### TwigJS templates
The data of an object is available as patterns. Tags and Meta information is only available, if these properties have been downloaded (see option 'properties'). Variables will automatically be HTML escaped, if not the filter `raw` is used, e.g.: `{{ tags.name|raw }}`.

The templates will be rendered when the object becomes visible and when the zoom level changes.

* `id` (the id of the object is always available, prefixed 'n' for nodes, 'w' for ways and 'r' for relations; e.g. 'n1234')
* `osm_id` (the numerical id of the object)
* `sublayer_id` (the id of the sub layer)
* `type` ('node', 'way' or 'relation')
* `tags.*` (all tags are available with the prefix `tags.`, e.g. `tags.amenity`)
* `geometry` (stringified GeoJSON geometry)
* `meta.timestamp` (timestamp of last modification)
* `meta.version` (version of the object)
* `meta.changeset` (ID of the changeset, the object was last modified in)
* `meta.user` (Username of the user, who changed the object last)
* `meta.uid` (UID of the user, who changed the object last)
* `members`: Array of member objects (if loaded)
* `members[].id`: id of member
* `members[].tags`: tags of member (if loaded)
* `members[].meta`: meta of member (if loaded)
* `members[].sequence`: member is nth element
* `members[].role`: member has role
* `masters`: Array of links to current master objects:
* `masters[].id`: id of relation
* `masters[].tags`: tags of relation
* `masters[].meta`: meta of relation
* `masters[].sequence`: current object is nth member
* `masters[].role`: current object has role
* `map.zoom`: Current zoom level
* `map.center.lat`: Latitude of the view center
* `map.center.lon`: Longitude of the view center
* `map.metersPerPixel`: size of a pixel at the map center
* `const.*` (Values from the 'const' option)

Examples:
`Amenity: {{ tags.amenity }}`: might render as "Amenity: restaurant"
`{% if tags.cuisine=='pizza' %}🍕{% else %}🍴{% endif %}`: might render as "🍴"
`{% for k, v in tags %}{{ k }}: {{ v }}<br/>{% endfor %}`: list all tags with "key: value"
`<a href="{{ tags.website }}">{{ tags.name }}</a>`: Create a HTML link to the website with the tag `name` as title.

You can access the twig instance via `OverpassLayer.twig` for extending (e.g. with custom functions or filters). Use `OverpassLayer.twig.extendFunction(...)`.

If you set an arbitrary value within a twig template (e.g.: `{% set foo = "bar" %}`), it will also be available in further templates of the same object by using (e.g.: `{{ foo }}`). The templates will be evaluated in the order as they are defined.

## method addTo(map)
Add layer to the given map.

## method setBounds(bounds)
Forces a boundary (as with option `bounds`). Accept a boundary of the type
GeoJSON.

## method remove()
Removes the OverpassLayer and all its features.

## method recalc()
Calculates the object data for each visible feature and call the update event.

## method get(id, callback)
Load the given object, even if it should not be shown in the given layer / at the current zoom level.

The callback will be called with the following parameters: err, ob (see event `add`).

## method show(id, options, callback)
Show the given object, even if it should not be shown in the given layer / at the current zoom level.

The options parameter influences how the object should be shown. (Consecutive calls of show() will override the options of previous calls).

Available options:
* styles: Aside from the styles which are shown from the general options, show additional styles. (Array)

The callback will be called with the following parameters: err, ob, data (see event `add`).

## method hide(id)
Hide the given object, resp. remove show options. If it is shown due to layer definition, it will still be visible.

## method twigData(object)
Return twig data for object (for rendering).

## method setFilter(filter)
Set an additional filter. Will intiate a check_update_map(). See OverpassFrontend.Filter for details.

## method setLayout(id, layout)
You can define several layouts, which will be rendered for each object. The rendered objects can be accessed from the `layouts` attribute of the `data` parameter of the events (e.g. add, update, ...).

The layout parameter is a string in TwigJS template language. In contrast to the feature-templates, the result of the feature evaluation is available with the 'object' prefix. Also, autoescapeing is disabled (because feature templates render to HTML).

The layout paramter could also be a function, which will be called with an object with the `object` property. If the function returns `null`, the content of the popup will not be updated.

Example: `{{ object.title }}`.

## method getShiftWorld()
get the degrees by which the world should be shifted, to show map features at the current view port (e.g. when you wrap over -180 or 180 longitude). E.g. near lon 180, the Eastern hemisphere (lon 0 .. 180) does not have to be shifted, the Western hemisphere (lon -180 .. 0) has to be shifted by 360 degrees.

Returs an array with two elements: degrees to shift the Western hemisphere, degrees to shift the Eastern hemisphere. Each value is a multiple of 360.

## event 'add', Paramters: ob, data
Will be called when an object appears on the map (e.g. load from server, zoom in, viewport moves in)

Parameter:
* `ob`: an OverpassObject object
* `data.id`: Unique ID of the object (e.g. 'w1234')
* `data.object` is an instance of OSMObject (see OverpassFrontend for details)
* `data.data` are the parsed options for the current object.
* `data.features`: an object with all leaflet feature which show the object. Index is the id of the style (e.g. 'highlight' for 'style:highlight'. 'default' for 'style').
* `data.feature`: the first leaflet feature (of the styles array). it will be used for binding popups to.
* `data.featureMarker`: the leaflet marker, if a marker is shown on the object
* `data.layouts`: The rendered version of all layouts as object (indexed by the layout id)
* `data.popup`: the popup, which is attached to the object (even if it is not shown)
* `data.styles`: array of style-ids which are currently active
* `data.isShown`: whether the object is currently shown on the map (boolean)
* `data.listItem`: DOM node of the list item which shows this object (if item is shown and a list has been added for this layer)

## event 'remove', Parameters: ob, data
Will be called when an object disappears from the map (e.g. zoom out, pan out, ...)

See `add` for the description of parameters.

## event 'zoomChange', Parameters: ob, data
Will be called every time when the zoom level changes. Occurs instantly after zoom level change for each object, before assessing if the object is visible at the current zoom level.

See `add` for the description of parameters.

## event 'update', Parameters: ob, data
Called every time, when the object is being re-calculated (also when zoom level changes).

See `add` for the description of parameters.

## event 'twigData', Parameters: ob, data, result
Called for every object on re-calculation. Result is the twigData which will used for evaluating each object. Any listeners may modify this result object.

See `add` for the description of other parameters.

## event 'layeradd', no parameters.
Emitted when the layer gets added.

## event 'layerremove', no parameters.
Emitted when the layer gets removed.

# Optional features
## Text along lines
```sh
npm install --save leaflet-textpath
```

Include script:
```html
<script src="node_modules/leaflet-textpath/leaflet.textpath.js"></script>
```

The style of the text labels can be set with these parameters:

| Field | Type | Default | Description
|-------|------|---------|-------------
| text | string | *null* | Label to show along the line (*null* for no label). (this impacts performace, as SVG labels are used).
| textRepeat | boolean | false | Specifies if the text should be repeated along the polyline.
| textCenter | boolean | false | Centers the text according to the polyline's bounding box.
| textOffset | float | 0 | Set an offset to position text relative to the polyline.
| textBelow | boolean | false | Show text below the path.
| textFill | color | black | Color of the text.
| textFillOpacity | opacity | 1.0 | Text opacity.
| textFontWeight | string | normal | Boldness or lightness of the glyphs used to render the text.
| textFontSize | font size | 12px | Font size of the text.
| textLetterSpacing | float | 0 | Extra letter spacing of the text.

## Line offset
```sh
npm install --save leaflet-polylineoffset
```

Include script:
```html
<script src="node_modules/leaflet-polylineoffset/leaflet.polylineoffset.js"></script>
```

Each style can have an 'offset' parameter, which will offset the line. It's of type 'length', so you can use units.

## Pattern
```sh
npm install --save leaflet-polylinedecorator
```

Include script:
```html
<script src="node_modules/leaflet-polylinedecorator/dist/leaflet.polylineDecorator.js"></script>
```

Each style can have several patterns with this additional options (where X identifies the pattern. X is an arbitrary string without dashes, e.g. '', '0', 'A', 'foobar'):

* patternX: false/empty: no pattern, 'arrowHead', 'dash', 'marker'
* patternX-offset: Offset of the first pattern symbol, from the start point of the line (type `length`; support for percentage). Default: 0.
* patternX-endOffset: Minimum offset of the last pattern symbol, from the end point of the line (type `length`; support for percentage). Default: 0.
* patternX-repeat: Repetition interval of the pattern symbols (type `length`; support for percentage). Defines the distance between each consecutive symbol's anchor point.
* patternX-lineOffset: Left (negative) or Right (positive) offset (type `length`). Default: 0.

Depending on the type of pattern, the following options are available:
* arrowHead:
 * patternX-polygon: true/false
 * patternX-pixelSize: size of pattern (type `length`, you may specify units)
 * patternX-headAngle: Angle of the digits
 * patternX-angleCorrection: degrees ([see #88](https://github.com/bbecquet/Leaflet.PolylineDecorator/pull/88))

* dash:
 * patternX-pixelSize: size of pattern (type `length`, you may specify units)

* marker:
 * patternX-rotate: false
 * patternX-angleCorrection: degrees

To set path options use the prefix `patternX-path-`, e.g. `patternX-path-width` or `patternX-path-color`.
