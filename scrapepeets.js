var jsdom = require('jsdom');
var Q = require('q');
var _ = require('lodash');
var urlparser = require('url');

var categoryMap = {
  "Coffee": "coffee/featured-coffee/all-coffees.html",
  "Tea": "tea/featured-tea/all-teas.html",
  "Valentines Day": "gifts-goods/featured-gifts/valentines-day-gifts.html",
  "Sale": "gifts-goods/featured-gifts/valentines-day-gifts.html",
  "Brewing Gifts": "gifts-goods/featured-gifts/brewing-gifts.html",
  "Top Gifts": "gifts-goods/featured-gifts/gifts-goods-top-sellers.html",
  "Gift Collections": "gifts-goods/featured-gifts/gifts-goods-gift-collections.html",
  "Tea Gifts": "gifts-goods/by-tea/gifts-goods-tea-gifts.html",
  "Coffee Gifts": "gifts-goods/by-coffee/coffee-gifts.html",
  "Coffee Samplers": "gifts-goods/by-coffee/gifts-goods-coffee-samplers.html",
  "Drinkware": "gifts-goods/other-gifts/gifts-goods-drinkware-logo-items.html",
  "Treats": "gifts-goods/other-gifts/gifts-goods-treats-spices.html",
  "Gift Cards": "gifts-goods/other-gifts/gifts-goods-peets-cards.html",
  "Wedding Gifts": "gifts-goods/by-occasion/gifts-goods-shop-by-occasion-wedding-gifts.html",
  "Birthday Gifts": "gifts-goods/by-occasion/gifts-goods-shop-by-occasion-birthday-gifts.html",
  "Thank You Gifts": "gifts-goods/by-occasion/gifts-goods-shop-by-occasion-thank-you-gifts.html"
};

main();

function main() {
  console.log('NAME,KEYWORDS,DESCRIPTION,SKU,BUYURL,AVAILABLE,IMAGEURL,PRICE');
  Q
    .fcall(function() {
      return Object.keys(categoryMap).map(scrapeCategory)
    })
    .then(Q.all)
    .then(_.flatten)
    .then(function(list) {
      return _(list).orderBy('buyurl').sortedUniqBy('buyurl').value();
    })
    .then(function(list) {
      list.map(function(p) {
        console.log([
          p.name,
          csvQuote(p.keywords),
          csvQuote(p.description),
          p.sku,
          p.buyurl,
          p.available,
          p.imageurl,
          p.price
        ].join(','));
      });
    });
}

function csvQuote(field) {
  return '"' + field.replace(/\\/g, '\\').replace(/"/g, '\"') + '"';
}

function getCategoryUrl(category) {
  return 'http://www.peets.com/' + categoryMap[category] + '?limit=all&mode=list';
}

function scrapeCategory(category) {
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
  return Array.prototype.slice.call(window.document.querySelectorAll('#products-list li'))
    .map(scrapeProduct);
}

function scrapeProduct(element) {
  return {
    name: getProductName(element),
    keywords: getProductKeywords(element),
    description: getProductDescription(element),
    sku: getProductSku(element),
    buyurl: getProductBuyUrl(element),
    available: getProductAvailability(element),
    imageurl: getProductImageUrl(element),
    price: getProductPrice(element)
  };
}

function getProductName(element) {
  return element.querySelector('.product-name a').innerHTML.replace(/\s\s+/g, '');
}

function getProductKeywords(element) {
  var keywords = getProductName(element).replace(/[^A-Za-z ]/g, ' ').toLowerCase().split(' ');
  return _.filter(keywords, function(keyword) { return keyword.length > 0; }).join(',');
}

function getProductDescription(element) {
  return element.querySelector('.desc').innerHTML.replace(/\s\s+/g, '');
}

function getProductSku(element) {
  return element.id.substring(8);
}

function getProductBuyUrl(element) {
  var link = element.querySelector('.product-link').href;
  var lastSlash = link.lastIndexOf('/');
  return 'http://www.peets.com' + link.substring(lastSlash);
}

function getProductAvailability(element) {
  return element.querySelectorAll('.violator-Out_Of_Stock').length === 0 ? "YES" : "NO";
}

function getProductImageUrl(element) {
  return element.querySelector('.product-image img').src;
}

function getProductPrice(element) {
  return element.querySelector('.price').innerHTML.substring(1);
}
