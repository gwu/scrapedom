var jsdom = require('jsdom');
var request = require('request');
var Q = require('q');
var _ = require('lodash');

var categoryMap = {
  "Women > Tops > Jackets and Blazers": "womens-outerwear-coats-jackets",
  "Women > Tops > Shirts": "womens-tops",
  "Women > Bottoms": "womens-bottoms",
  "Women > Bottoms > Leggings": "womens-bottoms-leggings",
  "Women > Bottoms > Pants": "womens-bottoms-dress-pants",
  "Women > Bottoms > Skirts": "womens-bottoms-skirts",
  "Women > Bottoms > Denim": "womens-bottoms-jeans",
  "Women > Dresses": "womens-dresses",
  "Women > More > Intimates": "womens-sleep-intimates-bras-panties",
  "Women > More > Pajamas": "womens-sleep-intimates-sleepwear",
  // "Men > Waist Up > Button Downs": "mens-shirts-collared-shirts",
  // "Men > Waist Up > Jackets": "mens-outerwear",
  // "Men > Waist Down": "mens-bottoms",
  // "Men > Shoes": "mens-shoes",
  // "Accessories > Swimwear": "womens-swim",
  // "Accessories > Jewelry": "jewelry",
  // "Accessories > Sunglasses": "womens-accessories-eyewear-sunglasses",
  // "Accessories > Hats": "womens-accessories-hats",
  // "Accessories > Gadgets": "tech-electronics-gadgets",
  // "Accessories > Socks": "mens-underthings-socks",
  // "Accessories > Wallets": "mens-accessories-bags-wallets",
  // "Home > Bed": "home-bedding",
  // "Home > Bath": "home-bath",
  // "Home > Kitchen": "home-kitchen"
};

var N_PER_CATEGORY = 10;

main();

function main() {
  Q
    .fcall(function() {
      return Object.keys(categoryMap).map(scrapeCategory)
    })
    .then(Q.all)
    .then(_.flatten)
    .then(console.log);
}

function getCategoryUrl(category) {
  return 'http://www.storenvy.com/search/products.json?page=1&per_page=10&category=' + categoryMap[category];
}

function getProductUrl(product) {
  return 'http://www.storenvy.com/products/' + product;
}

function scrapeCategory(category) {
  return getCategoryJson(category)
    .then(function(json) {
      return json.products.map(function(productJson) {
        return scrapePdp(productJson.to_param);
      });
    })
    .then(Q.all)
    .then(function(productJsons) {
      return productJsons.map(function(productJson) {
        productJson.category = category;
        return productJson;
      });
    });
}

function getCategoryJson(category) {
  var deferred = Q.defer();

  request(getCategoryUrl(category), function(err, response, body) {
    if (err) {
      return deferred.reject(new Error(err));
    }
    if (response.statusCode !== 200) {
      return deferred.reject(new Error(response));
    }
    deferred.resolve(JSON.parse(body));
  });

  return deferred.promise;
}

function scrapePdp(product) {
  var deferred = Q.defer();

  jsdom.env({
    url: getProductUrl(product),
    features: {
      ProcessExternalResources: false // ['script']
    },
    done: function (err, window) {
      if (err) {
        return deferred.reject(new Error(err));
      }
      deferred.resolve({
        product_id: product,
        brand: getBrand(window),
        description: getDescription(window),
        images: getImageUrls(window),
        price: getPrice(window),
        options: getOptions(window)
      });
    }
  });

  return deferred.promise;
}

function getImageUrls(window) {
  var mainUrl = window.document.querySelector('#main-photo img').src;

  var alternates = window.document.querySelectorAll('.thumbnails img');
  var alternateUrls = Array.prototype.slice.call(alternates).map(function(e) {
    return e.src.replace(/_small.jpg$/, '_original.jpg');
  })

  return [mainUrl].concat(alternateUrls);
}

function getPrice(window) {
  return window.document.querySelector('.price')
    .innerHTML
    .replace(/\s/g, '');
}

function getDescription(window) {
  return window.document.querySelector('.product-description .desc-wrap')
    .innerHTML
    .replace(/\s\s+/g, '');
}

function getBrand(window) {
  return window.document.querySelector('.store-name a').innerHTML;
}

function getOptions(window) {
  var options = window.document.querySelectorAll('.variant_dropdown option');
  return Array.prototype.slice.call(options)
    .filter(function(option, i) {
      return i !== 0;
    })
    .map(function(option) {
      return option.innerHTML;
    });
}
