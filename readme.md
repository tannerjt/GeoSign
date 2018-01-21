# Geospatial Data Signatures

When an authority creates geospatial data, it often finds itself mashed up with other data at some point.  For example, take a series of address point screated by a local government.  A developer or analyst may query a subset of those addresses, and then merge them with other points of interest, like retail store locations that were digitized manually by using aerial imagery.  Now, we have a dataset that contains both new data, and a subset of data that came from an authoritative source.  The problem is; how can we verify which points are authoritative, and which are not?

In order to do this, we need each feature to a signature that is unique.  To do this, we can use a hash function.

## Hash Function

A hash function takes an input of arbitrary size, and returns a value that is fixed in size that is entirely unique.  By unique, I mean that no other combination of input (very high collision resistance) would create the same output value.  For example, let's take the string 'John Smith'.  Running this through a hash function might produce the hash of 001234.  With a hash function, is is very unlikely that any other combination of letters would produce the output 001234.

Let's use node.js to illustrate using a hash function:

```js
const crypto = require('crypto');
const hash = crypto.createHash('sha256');

hash.update('John Smith');
console.log(hash.digest('hex'));
```

Output:

```
ef61a579c907bbed674c0dbcbcf7f7af8f851538eef7b8e58c5bee0b8cfdac4a
```

Notice we used sha256, a cryptographic hash algorithm (2^256 possible combinations).  Hash algorithms produce irreversible and unique hashes.  The argument for the digest method represents that output format, and can be "binary", "hex" or "base64".

## Comparing Hashes

Hashes are deterministic, meaning that given the same input, they will always calculate the exact same hash.  Knowing this, we can create a new hashed value, and compare it against known hashes to see if there are any mathces.

```js
// Master List
let master_hashes = [];
let name = "Noah";
var hash = crypto.createHash('sha256');
hash.update(name);
master_hashes.push(hash.digest('hex'));

// Check new values against known values
let name1 = "Noah";
var hash = crypto.createHash('sha256');
hash.update(name1);
let name1Hash = hash.digest('hex');

let name2 = "Josh";
var hash = crypto.createHash('sha256');
hash.update(name2);
let name2Hash = hash.digest('hex');

// Is name1 in master list
if(master_hashes.indexOf(name1Hash) !== -1) {
  console.log(name1 + " is in master list");
} else {
  console.log(name1 + " is not in master list");
}

// Is name2 in master list
if(master_hashes.indexOf(name2Hash) !== -1) {
  console.log(name2 + " is in master list");
} else {
  console.log(name2 + " is not in master list");
}
```

Output:

```
Noah is in master list
Josh is not in master list
```

## Why Not Just Compare Original Complete Values?

Looking at the example above, you may be wondering why we are hashing anything in the first place.  Can't we just compare the two original strings to see if they are they same?  The answer is yes, but hashes are fixed in length and can represent very large inputs.  For example, a geometry representing a simple curved line could be easily made up of thousands of coordinate pairs.  By hashing the input, we can have a fixed 256 bit output to use in comparison.

The other reason to use hashes is to provide fast lookups.  We can use hash tables to provide constant time O(N ) lookup of hashes.  Even if we store the hashes in a database, we can still achive O(logN) lookup time if we index our hashes.  We can even hash an entire file and see if a whole file can be considered autoritative (think checksums).

## Spatial Data Formats and Hashing

There are many different formats for storing geospatial data.  Shapefile, file geodatabase, kml, geopackage, spatialite, and geojson are examples for storing and accessing this data.  Generally speaking, we could hash the entire file and check it against a known authoritative hash.  However, to solve the problem of verifying feature level data against known authoritative features, we are primarily interest in two things:

1. A features geometry
2. Properties associated with a feature

By creating a hash of both, we will be able to check if a features geometry, properties, or both match any known autoritative features.

## Hashing Geometry and Properties

Let's assume that we want we want to validate against the same precision and scale of coordinate pairs as they were collected.  Secondly, let's assume we that our hash only contains coordinates registered as geographic latitude and logitude pairs.  

So, let's assume the GeoJSON representation of a building point geometry for the Oregon Department of Agriculture in Salem, Oregon:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Oregon Department of Agriculture"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [
          -123.02664,
          44.94365
        ]
      }
    }
  ]
}
```

Now, if we assume that this point was created by an authoritative entity, we will need to register both the geometry and properties by their unique hash.  Let's create a module that will register hashes into a JSON object, using simple in memory storage for now:

```js
// geoAuthStore.js
const crypto = require('crypto');

function geoStore() {
  // In memory object store
  this.db = {};

  this.registerLocation = function (lat, lng) {
    let hash = crypto.createHash('sha256')
                .update(','.concat(+lat, +lng))
                .digest('hex');
    this.db[hash] = 1;
    return hash;
  }

  this.registerProperties = function (propertiesObj) {
    let hash = crypto.createHash('sha256')
                .update(JSON.stringify(propertiesObj))
                .digest('hex');
    this.db[hash] = 1;
    return hash;
  }

  this.lookup = function (hash) {
    return this.db[hash] ? true : false;
  }
}

module.exports = geoStore;
```

The simple module above allows us to register authoritative geometry and properties as unique hashes in a javascript object.  We can also lookup to see if a given hash already exists.  Let's use this in a simple example to register some authoritative features and check them against a sample mashup of both authoritative and non-authoritative locations:

```js
const crypto = require('crypto');
const Store = require('./3store.js');

let store = new Store();

store.registerLocation(44.94365, -123.02664);
store.registerProperties({"name": "Oregon Department of Agriculture"});

console.log(store.db);
//{ bf370cd7725d9f6459e258821fe9b94ed88f66d76e473275d011c7de40b14697: 1,
//  b2919b1be41b302f8c25602e83077c41a6f4892ffc2256e7bdf7d68644dc5d7a: 1 }

let geojson = {
  "type": "FeatureCollection",
  "features": [
    // Authoritative Feature
    {
      "type": "Feature",
      "properties": {
        "name": "Oregon Department of Agriculture"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [
          -123.02664,
          44.94365
        ]
      }
    },
    // Non-Authoritative Location
    {
      "type": "Feature",
      "properties": {
        "name": "Waldo Park",
      },
      "geometry": {
        "type": "Point",
        "coordinates": [
          -123.02611,
          44.94515
        ]
      }
    }
  ]
}

// Validate features against authoritative locations
for(var i = 0; i < geojson.features.length; i++) {
  // check geometry and properties for match
  let feature= geojson.features[i];
  let geomMatch = store.lookup(crypto.createHash('sha256')
                .update(','.concat(feature.geometry.coordinates[1],
                                    feature.geometry.coordinates[0]))
                .digest('hex')
              );
  let propertiesMatch = store.lookup(crypto.createHash('sha256')
              .update(JSON.stringify(feature.properties))
              .digest('hex'));
  if(geomMatch && propertiesMatch) {
    // Authoritative
    feature.properties['marker-color'] = '#00ff00';
  } else {
    // Not Authoritative
    feature.properties['marker-color'] = '#ff0000';
  }
}

console.log(JSON.stringify(geojson));
```

You can see the output GeoJSON [map here](https://gist.github.com/anonymous/fbe2e86b30bee0777de97130d1426946), where red shows the non-authoritative location, and green shows the authoritative location.

### Links

[Using Crypto Module](https://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module/)

[Measuring Accuracy of Lat and Lng](https://gis.stackexchange.com/questions/8650/measuring-accuracy-of-latitude-and-longitude)
