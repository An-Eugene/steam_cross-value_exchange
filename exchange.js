// ==UserScript==
// @name         Steam cross-value exchange
// @namespace    Aneugene
// @version      0.4.4
// @description  Steam auto change values. Also show exchange value and different prices
// @author       Aneugene
// @match        store.steampowered.com/*
// @match        steamcommunity.com/*
// @downloadURL  https://raw.githubusercontent.com/An-Eugene/steam_cross-value_exchange/main/exchange.js
// @updateURL    https://raw.githubusercontent.com/An-Eugene/steam_cross-value_exchange/main/exchange.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=steampowered.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

// https://flagsapi.com/

let app_settings = JSON.parse(`
{
  "exchange" : {
    "bank_api_link" : "https://www.cbr-xml-daily.ru/daily_json.js",
    "api_path" : {
      "value" : ["Value"],
      "nominal" : ["Nominal"]
    },
    "from" : {
      "sign" : "₸",
      "path" : ["Valute", "KZT"]
    },
    "to" : {
      "sign" : "₽",
      "steam_variation" : "руб."
    }
  },
  "comparison" :
  [
    {
      "cc" : "kz",
      "path" : ["Valute", "KZT"],
      "sign" : "₸"
    },
    {
      "cc" : "ru",
      "sign" : "₽"
    },
    {
      "cc" : "eu",
      "path" : ["Valute", "EUR"],
      "sign" : "€"
    },
    {
      "cc" : "tr",
      "path" : ["Valute", "USD"],
      "sign" : "$"
    },
    {
      "cc" : "us",
      "path" : ["Valute", "USD"],
      "sign" : "$"
    }
  ]
}`);

function main() {
  const steam_elements = [
    new MarketElementPrecise('#header_wallet_balance'),
    new PriceOnHoldElementPrecise('#header_wallet_balance .tooltip'),
    new PriceElementPrecise('#marketWalletBalanceAmount'),
    new PriceElementPrecise('.accountData.price > a'),
    new PriceElementPrecise('#market_buyorder_dialog_walletbalance_amount'),
    new PriceElementPrecise('#market_buy_commodity_order_total'),
    new PriceElementPrecise('.Panel.Focusable > div > div > div > span'),
    new PriceElementRough('.StoreOriginalPrice'),
    new PriceElementRough('.StoreOriginalPrice + div'),
    new PriceElementRough('.Panel.Focusable span > div'),
    new PriceElementRough('.discount_prices > div'),
    new PriceElementRough('.discount_final_price div:last-child'),
    new PriceElementRough('.game_area_dlc_price'),
    new PriceElementRough('.match_app .match_subtitle'),
    new PriceElementRough('.search_price'),
    new PriceElementRough('.col.search_price'),
    new PriceElementRough('.col.search_price.discounted'),
    new PriceElementRough('.col.search_price strike'),
    new PriceElementRough('.normal_price'),
    new PriceElementRough('.StoreSalePriceWidgetContainer > div:not(:has(div))'),
    new PriceElementRough('.StoreSalePriceWidgetContainer > div > div'),
    new PriceElementRough('.game_purchase_price'),
    new PriceElementRough('.price'),
    new PriceElementRough('.savings.bundle_savings'),
    new MarketElementPrecise('.item_market_actions > div div:nth-child(2)'),
    new PriceElementPrecise('#market_commodity_forsale > span:nth-of-type(2)'),
    new PriceElementPrecise('#market_commodity_buyrequests > span:nth-of-type(2)'),
    new PriceElementPrecise('.market_commodity_orders_table tr td:first-child'),
    new TableLastElementPrecise('.market_commodity_orders_table tr:last-child td:first-child'),
    new MarketActivityElementPrecise('#market_activity_block > div > span'),
    new MarketGraphPrecise('.jqplot-axis > div'),
    new MarketGraphTooltipPrecise('.jqplot-highlighter-tooltip')
  ];

  const css = new CSSImplementerCustom();
  const exchange = new Exchanger(app_settings.exchange);
  exchange.init();

  const parser = new PriceReplacer(steam_elements, exchange);
  parser.scheduleReplacePrices(0.5);

  const exchange_viewer = new ExchangeViewerRu(exchange);
  exchange_viewer.placeHTMLBlock();
  css.append(exchange_viewer.css);

  const price_comparison = new PriceComparison(exchange, app_settings.comparison);
  price_comparison.placeHTMLBlock();
  css.append(price_comparison.css);
}


// Classes *******************************************************************************************************************************

class HTTPRequest {
  _link = undefined;
  _json_value = undefined;
  //_content = undefined;
  //_json_path = undefined;
  _is_parsed = false;

  get is_parsed() {return this._is_parsed;}

  init() {
    GM_xmlhttpRequest({
      method: "GET",
      url: this._link,
      headers: {
        "Content-Type": "application/json"
      },
      onload: (response) => {
        this._json_value = JSON.parse(response.responseText);
        this._is_parsed = true;
      }
    });
  }

  _parseValueFromJSON(value, data) {
    let destination_value = data;
    for (let key of value) {
      if (destination_value.hasOwnProperty(key)) {
        destination_value = destination_value[key];
      } else {
        return undefined;
      }
    }
    return destination_value;
  }

  _parseValue() {}
}


class Exchanger extends HTTPRequest {
  constructor(settings) {
    super();
    this._link = settings.bank_api_link;
    this._currency_from = settings.from.sign;
    this._default_path = settings.from.path;
    this._currency_to = settings.to.sign;
    this._currency_to_reference = settings.to.steam_variation;
    this._value_path = settings.api_path.value;
    this._nominal_path = settings.api_path.nominal;
  }

  get from() { return this._currency_from; }
  get to() { return this._currency_to; }
  get to_reference() { return this._currency_to_reference; }

  //get value() { return this.value(); }
  value(path) {
    if (path) {
      return this._parseValue(path);
    } else {
      return this._parseValue(this._default_path);
    }
  }

  //get nominal() { return this.nominal(); }
  nominal(path) {
    if (path) {
      return this._parseNominal(path);
    } else {
      return this._parseNominal(this._default_path);
    }
  }

  _parseValue(path) {
    let valute_block = this._parseValueFromJSON(path, this._json_value);
    let valute_value = this._parseValueFromJSON(this._value_path, valute_block);
    if (this._nominal_path) {
      let valute_nominal = this._parseValueFromJSON(this._nominal_path, valute_block);
      return valute_value / valute_nominal;
    }
    return valute_value;
  }

  _parseNominal(path) {
    if (this._nominal_path) {
      let valute_block = this._parseValueFromJSON(path, this._json_value);
      return this._parseValueFromJSON(this._nominal_path, valute_block);
    }
  }
}


class PriceReplacer {
  _elements = undefined;
  _exchange = undefined;
  _scheduler = undefined;
  _first_time = true;

  constructor(elements, exchange) {
    this._elements = elements;
    this._exchange = exchange;
  }

  scheduleReplacePrices(period) {
    this._replacePrices();
    this._scheduler = setInterval(() => {this._replacePrices();}, Math.floor(parseFloat(period) * 1000));
  }

  destroySchedule() {
    if (this._scheduler === undefined) {return;}
    clearInterval(this._scheduler);
  }

  _replacePrices() {
    if (!this._exchange.is_parsed){return;}
    this._elements.forEach((item) => {
      item.replacePrices(this._exchange.value(), this._exchange.from, this._exchange.to);
    });
    this._first_time = false;
  }
}


class PriceElement {
  _query = undefined;

  constructor(selector) {
    this._query = selector;
  }

  replacePrices(exchange_rate, original_valute, result_valute) {
    let elements = document.querySelectorAll(this._query);
    if (elements.length <= 0) {return;}

    elements.forEach((item) => {
      let element_content = this._getContent(item);
      if (!this._isReplaced(item) && this._contentReplacable(element_content, original_valute)) {
        let number = this._parseValue(element_content, original_valute);
        let output_string = this._generateOutputValue(number, exchange_rate, result_valute, original_valute);
        this._setContent(item, output_string);
        item.dataset.cveIsParsed = "true";
      }
    });
  }

  _getContent(item) {
    return item.textContent.trim().replace(' ', '');
  }

  _setContent(item, string) {
    item.textContent = string;
  }

  _isReplaced(item) {
    return item.dataset.cveIsParsed === "true";
  }

  _contentReplacable(content, original_valute) {
    let regexp = new RegExp('^[0-9]+([,.][0-9]{2})?' + original_valute + '$');
    return regexp.test(content);
  }

  _parseValue(text, original_valute) {
    return parseFloat(text.replace(original_valute, '').replace(',', '.'));
  }

  _generateOutputValue(number, exchange_rate, result_valute, original_valute) {} // return int
}


class PriceElementRough extends PriceElement {
  _generateOutputValue(number, exchange_rate, result_valute, original_valute) {
    return Math.ceil(number * exchange_rate) + ' ' + result_valute + ' (' + number + ' ' + original_valute + ')';
  }
}


class PriceElementPrecise extends PriceElement {
  _generateOutputValue(number, exchange_rate, result_valute, original_valute) {
    return (number * exchange_rate).toFixed(2) + ' ' + result_valute + ' (' + number + ' ' + original_valute + ')';
  }
}


class MarketElementPrecise extends PriceElementPrecise {
  _getContent(item) {
    let price_string = item.innerHTML.split('<br>')[0];
    let cut = [...price_string].findIndex((char) => !isNaN(parseInt(char)));
    //this._pre_element = price_string.substring(0, cut-1);

    return price_string.substring(cut-1).trim().replace(' ', '');
  }

  _setContent(item, string) {
    if (item.innerHTML.indexOf('<br>') > -1) {
      item.innerHTML = string + item.innerHTML.substring(item.innerHTML.indexOf('<br>'));
    } else {
      item.innerHTML = string
    }
  }
}


class MarketGraphPrecise extends PriceElementPrecise {
  _generateOutputValue(number, exchange_rate, result_valute, original_valute) {
    return (number * exchange_rate).toFixed(2) + ' ' + result_valute;
  }
}


class MarketGraphTooltipPrecise extends PriceElementPrecise {
  _getContent(item) {
    let whole_string = item.innerHTML.split('<br>');
    this._pre_element = whole_string[0] + '<br>';
    let price = whole_string[1];
    this._post_element = '<br>' + whole_string[2];

    return price;
  }

  _setContent(item, string) {
    item.innerHTML = this._pre_element + string + this._post_element;
  }
}


class TableLastElementPrecise extends PriceElementPrecise {
  _getContent(item) {
    let whole_string = item.innerHTML.split(" ");
    let price = whole_string.shift();
    price += whole_string.shift();
    this._post_element = whole_string.join(" ").trim();

    return price;
  }

  _setContent(item, string) {
    item.innerHTML = string + ' ' + this._post_element;
  }
}



class MarketActivityElementPrecise extends PriceElementPrecise {
  _getContent(item) {
    let whole_string = item.innerHTML.split(" ");
    let price = whole_string.pop();
    this._pre_element = whole_string.join(" ").trim();

    return price;
  }

  _setContent(item, string) {
    item.innerHTML = this._pre_element + ' ' + string;
  }
}

class PriceOnHoldElementPrecise extends PriceElementPrecise {
  _getContent(item) {
    let whole_string = item.innerHTML.split(":");
    let price = whole_string[1].trim();
    this._pre_element = whole_string[0] + ":";

    return price.replace(' ', '');
  }

  _setContent(item, string) {
    item.innerHTML = this._pre_element + ' ' + string;
    }
}


class HTMLBlock {
  _element = undefined;
  _schedule_place = undefined;
  _query_selector = undefined;

  constructor() {
    this._element = document.createElement('div');
  }

  get css() {} // define CSS

  placeHTMLBlock(query_selector) {
    let parent_block = document.querySelector(this._query_selector);
    if (parent_block) {
      this._schedule_place = setInterval(() => {this._placeHTMLBlock(parent_block);}, 500);
    }
  }

  _placeHTMLBlock(parent_block) {}
}


class ExchangeViewer extends HTMLBlock{
  _text_before = undefined;
  _exchange = undefined;

  constructor(exchange) {
    super();
    this._exchange = exchange;
    //this._original_multiplier = this._exchange.nominal();
    this._element.className = "cross_value_exchange__exchangeviewer";
    this._query_selector = "#global_action_menu";
  }

  get css() {
    return `.cross_value_exchange__exchangeviewer{
      display: inline-block;
      position: relative;
      height: 24px;
      line-height: 24px;
      background-color: rgba(103, 112, 123, 0.2);
      padding-left: 9px;
      padding-right: 9px;
      color: rgb(229, 228, 220);
    }`
  }

  _placeHTMLBlock(parent_block) {
    if (!this._exchange.is_parsed) {return;}

    clearInterval(this._schedule_place);
    this._element.innerHTML = this._text_before + " " +
                              this._exchange.nominal() +
                              " " + this._exchange.from +
                              " = " +
                              (this._exchange.nominal() * this._exchange.value()).toFixed(2) +
                              " " + this._exchange.to;
    parent_block.insertBefore(this._element, parent_block.firstChild);
  }
}


class ExchangeViewerRu extends ExchangeViewer {
  constructor(exchange) {
    super(exchange);
    this._text_before = "Курс:";
  }
}

class CSSImplementer {
  _element = undefined;
  _css = '';
  _is_placed = false;

  constructor() {
    this._element = document.createElement("style");
    this._element.type = "text/css";
  }

  append(text) {
    this._element.appendChild(document.createTextNode(text));
  }

  place() {
    if (this._is_placed) {return;}
    this.append(this._css);
    document.head.appendChild(this._element);
    this._is_placed = true;
  }
}

class CSSImplementerCustom extends CSSImplementer {
  _css = `
  .market_listing_their_price {
    width: 140px!important;
  }
  .tab_item_discount {
    width: 160px!important;
  }
  #market_buy_commodity_order_total {
    width:auto!important;
  }`;

  constructor() {
    super();
    this.place();
  }
}


class PriceComparison extends HTMLBlock{
  _nominal_item = undefined;
  _other_items = [];
  _is_valid = undefined;
  _exchange = undefined;

  constructor(exchange, settings) {
    super();

    if (!window.location.href.startsWith('https://store.steampowered.com/app/')) {
      this._is_valid = false;
      return;
    }
    this._is_valid = true;
    this._exchange = exchange;

    this._element = document.createElement('div');
    this._element.className = 'cross_value_exchange__price_comparison game_area_purchase_game';
    this._element.innerHTML = '';
    for (let setting of settings) {
      let new_element = new ComparisonElement(setting.cc, setting.sign, setting.path);
      new_element.init();
      this._other_items.push(new_element);
    }
    this._query_selector = '#game_area_purchase';
  }

  get css() {
    return `
    .cross_value_exchange__price_comparison {
      background: linear-gradient( -60deg, rgba(226,244,255,0.3) 5%,rgba(84, 107, 115, 0.3) 95%);
      border-radius: 4px;
      font-family: "Motiva Sans", Sans-serif;
      font-weight: normal;
      font-size: 13px;
      color: #c6d4df;
      padding: 16px;
      padding-bottom: 26px;
      margin-bottom: 28px;
      position:relative;
      z-index: 1;
    }
    .comparison_element__flag {
      width: 48px;
      height: 32px;
      object-fit:cover;
    }
    .comparison_block__flex {
      position: unset!important;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      margin-bottom:-46px;
      margin-top:3px;
    }
    .comparison_block__flex > * {
      margin-top: 2px;
    }
    .comparison_element__discount_equal {
      background: #484848!important;
      color: #8c8c8c!important;
    }
    .comparison_element__discount_more {
      background: #6b2922!important;
      color:#ee112b!important;
    }
    .comparison_element__price {
      background-color: #000000!important;
      font-size: 13px!important;
      height: 24px!important;
      padding-top: 8px!important;
      padding-left: 12px!important;
      padding-right: 12px!important;
      color:#c6d4df;
    }
    .comparison_element__price_unavailable {
      color:#7e878f;
    }`;
  }

  _placeHTMLBlock(parent_block) {
    if (!this._is_valid) {
      clearInterval(this._schedule_place);
      return;
    }
    for (let item of this._other_items) {
      if (!item.is_parsed) { return; }
    }
    clearInterval(this._schedule_place);
    this._identify_nominal();
    this._compile();
    parent_block.insertBefore(this._element, parent_block.firstChild);
  }

  _identify_nominal() {
    for (let item of this._other_items) {
      if (item.is_available()) {
        this._nominal_item = item;
        break;
      }
    }
  }

  _compile() {
    let h1_element = '<h1>Стоимость игры ' + document.querySelector("#appHubAppName").textContent + ' в других регионах</h1>';
    let price_elements = '';
    let items = this._other_items;
    items.sort((a, b) => a.discount(this._nominal_item, this._exchange) - b.discount(this._nominal_item, this._exchange));
    items.forEach((item) => {
      price_elements += '<div class="game_purchase_action_bg">';
      price_elements += '<div class="discount_block game_purchase_discount">';
      price_elements += this._percentage_element(item);
      price_elements += this._price_element(item);
      price_elements += '</div>';
      price_elements += this._flag_element(item.cc);
      price_elements += '</div>';
    });

    let price_elements_wrapper = '<div class="game_purchase_action comparison_block__flex">' + price_elements + '</div>';

    this._element.innerHTML = h1_element + price_elements_wrapper;
  }

  _percentage_element(item) {
    let div_element = '<div class="discount_pct';
    if (!this._nominal_item || !item.is_available()) {
      //return div_element + ' comparison_element__discount_equal" style="font-size:15px;">N/A</div>';
      return '';
    }
    let discount = item.discount(this._nominal_item, this._exchange);
    if (discount > 0) {
      return div_element + ' comparison_element__discount_more">+' + discount + '%</div>';
    } else if (discount < 0) {
      return div_element + ' comparison_element__discount_less">' + discount + '%</div>';
    } else {
      return div_element + ' comparison_element__discount_equal">&nbsp;&nbsp;&nbsp;~&nbsp;&nbsp;&nbsp;</div>';
      //return '';
    }
  }
  _price_element(item) {
    if (!item.is_available()) {
      return '<div class="discount_prices comparison_element__price comparison_element__price_unavailable">unavailable</div>';
    }
    return '<div class="discount_prices comparison_element__price">' + item.price_string(this._exchange) + '</div>';
  }

  _flag_element(item) {
    let flag_link = 'https://flagcdn.com/h40/' + item + '.webp';
    return '<img class="comparison_element__flag" src="' + flag_link + '" alt="' + item + '">';
  }
}


class ComparisonElement extends HTTPRequest {
  _cc = undefined;
  _path = undefined;
  _sign = undefined;
  _game_number = undefined;

  constructor(cc, sign, path) {
    super();
    this._cc = cc;
    this._link = this._api_link();
    this._path = path;
    this._sign = sign;
  }

  get cc() { return this._cc; }

  _api_link() {
    let current_href = window.location.href;
    current_href = current_href.substring('https://store.steampowered.com/app/'.length);
    this._game_number = current_href.split('/')[0];
    return 'https://store.steampowered.com/api/appdetails?filters=price_overview&appids=' + this._game_number + '&cc=' + this._cc;
  }

  is_available() {
    return this._parseValueFromJSON([this._game_number, 'success'], this._json_value) === true;
  }

  price_string(exchange) {
    let string = '';
    if (this._path) {
      string = Math.floor(this.translated_price(exchange) / 100) + ' ' + exchange.to + ' (' + (this._original_price() / 100) + ' ' + this._sign + ')';
    } else {
      string = (this._original_price() / 100) + ' ' + this._sign;
    }
    return string;
  }

  discount(nominal, exchange) {
    if (nominal === this) {
      return 0;
    }
    if (!this.is_available()) {
      return 9999;
    }
    let discount = Math.floor((this.translated_price(exchange) / nominal.translated_price(exchange)) * 100) - 100;
    return discount;
  }

  translated_price(exchange) {
    if (!this._path) {
      return this._original_price();
    }
    let multiplier = exchange.value(this._path);
    return this._original_price() * multiplier;
  }

  _original_price() {
    if (!this.is_available) { return undefined; }
    let price_path = [this._game_number, 'data', 'price_overview', 'final'];
    return this._parseValueFromJSON(price_path, this._json_value);
  }

}

main();
