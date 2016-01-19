var jsdom = require('jsdom');
var request = require('request');
var Q = require('q');
var _ = require('lodash');
var urlparser = require('url');

var categoryMap = {
  "Women > Tops > Jackets and Blazers": "W-COATS-LIGHTWEIGHT",
  "Women > Tops > Shirts": "W_APP_BLOUSES",
  "Women > Bottoms > Leggings": "W_APP_LEGGINGS",
  "Women > Bottoms > Pants": "W_APP_PANTS",
  "Women > Bottoms > Skirts": "W_APP_BOTTOMS_SHORTS",
  "Women > Bottoms > Denim": "W_APP_JEANS",
  "Women > Dresses > Cocktail": "W-DRESSES-PARTY",
  "Women > Dresses > Mini": "W-DRESSES-MINI",
  "Women > Dresses > Maxi": "W-APP-DRESSES-MAXI",
  "Women > Dresses > Sweater": "W_APP_SWEATERS_DRESSES",
  "Women > More > Intimates": "W_INTIMATES",
  "Women > More > Pajamas": "W-LOUNGE-BOTTOMS",
  "Men > Waist Up > Button Downs": "M_TOPS_SHIRTS",
  "Men > Waist Up > Jackets": "M-JACKETS-TECH",
  "Men > Waist Down": "M_APP_PANTS",
  "Men > Waist Down > Jeans": "M_APP_JEANS",
  "Men > Waist Down > Shorts": "M_APP_SHORTSSWIM_SHORTS",
  "Men > Waist Down > Sweats": "M_APP_JOGGERS",
  "Men > Shoes": "MENS_SHOES",
  "Men > Shoes > Oxfords": "M_SHOES_DRESS",
  "Men > Shoes > Sneakers": "M_SHOES_SNEAKERS",
  "Accessories > Swimwear": "W_APP_SWIMWEAR",
  "Accessories > Jewelry": "W_ACC_JEWELRY",
  "Accessories > Sunglasses": "W_ACC_SUNGLASSES",
  "Accessories > Hats": "W_ACC_HATSA_MEDIA_TE",
  "Accessories > Gadgets": "A_MEDIA_TECH",
  "Accessories > Socks": "W_ACC_LEGGINGSANDTIGHTS"
};

var N_PER_CATEGORY = 25;

main();

function main() {
  Q
    .fcall(function() {
      return Object.keys(categoryMap).map(scrapeCategory)
    })
    .then(Q.all)
    .then(_.flatten)
    .then(function(list) {
      list.map(function(p) {
        console.log(JSON.stringify(p));
      });
    });
}

function getCategoryUrl(category) {
  return 'http://www.urbanoutfitters.com/urban/catalog/category.jsp?id=' + categoryMap[category];
}

function getProductUrl(product) {
  return 'http://www.urbanoutfitters.com/api/v1/product/' + product + '?siteCode=urban';
}

function scrapeCategory(category) {
  return getCategoryJson(category)
    .then(function(json) {
      return json.map(function(productJson) {
        return scrapePdp(productJson.id);
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

  jsdom.env({
    url: getCategoryUrl(category),
    done: function(err, window) {
      if (err) {
        return deferred.reject(new Error(err));
      }
      deferred.resolve(extractProductJsons(window));
    }
  });

  return deferred.promise;
}

function extractProductJsons(window) {
  return Array.prototype.slice.call(window.document.querySelectorAll('.product'))
    .map(function(productElement) {
      var url = productElement.querySelector('.product-image a').href;
      return {
        id: urlparser.parse(url, true).query.id
      };
    })
    .filter(function(x, i) {
      return i < N_PER_CATEGORY;
    });
}

function scrapePdp(product) {
  var deferred = Q.defer();

  request(getProductUrl(product), function(err, response, body) {
    if (err) {
      return deferred.reject(new Error(err));
    }
    if (response.statusCode !== 200) {
      return deferred.reject(new Error(response));
    }
    deferred.resolve(parseProductJson(JSON.parse(body), product));
  });

  return deferred.promise;
}

function parseProductJson(json, product) {
  return {
    product_id: product,
    brand: getBrand(json),
    description: getDescription(json),
    images: getImageUrls(json),
    price: getPrice(json),
    colors: getColors(json)
  };
}

function getImageUrls(json) {
  var c = json.product.colors[0];
  return c.viewCode.map(function(vc) {
    return 'http://images.urbanoutfitters.com/is/image/UrbanOutfitters/' + c.id + '_' + vc + '';
  });
}

function getPrice(json) {
  return '$' + json.product.skusInfo[0].priceLists[0].listPrice;
}

function getDescription(json) {
  return json.product.longDescription;
}

function getBrand(json) {
  return json.product.brand;
}

function getColors(json) {
  return json.product.colors.map(function(c) {
    return c.displayName;
  });
}
