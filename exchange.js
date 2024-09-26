// ==UserScript==
// @name         Steam cross-value exchange
// @namespace    Aneugene
// @version      0.5.6
// @description  Steam auto change values. Also show exchange value and different prices
// @author       Aneugene
// @match        store.steampowered.com/*
// @match        steamcommunity.com/*
// @downloadURL  https://raw.githubusercontent.com/An-Eugene/steam_cross-value_exchange/main/exchange.js
// @updateURL    https://raw.githubusercontent.com/An-Eugene/steam_cross-value_exchange/main/exchange.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=steampowered.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==


function main() {
  const steam_elements = [
    new MarketElementPrecise('#header_wallet_balance'),
    new PriceOnHoldElementPrecise('#header_wallet_balance .tooltip'),
    new PriceElementPrecise('#marketWalletBalanceAmount'),
    new PriceElementPrecise('.accountData.price > a'),
    new PriceElementPrecise('#market_buyorder_dialog_walletbalance_amount'),
    new PriceElementPrecise('#market_buy_commodity_order_total'),
    new PriceElementPrecise('.Panel.Focusable > div > div > div > span'),
    new SubscriptionElementPrecise('.game_area_purchase_game_dropdown_subscription .game_area_purchase_game_dropdown_selection span'),
    new SubscriptionElementPrecise('.game_area_purchase_game_dropdown_subscription .game_area_purchase_game_dropdown_menu_container td.game_area_purchase_game_dropdown_menu_item_text'),
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
  const exchange = new Exchanger(Settings.app_settings.exchange);
  exchange.init();

  const parser = new PriceReplacer(steam_elements, exchange);
  parser.scheduleReplacePrices(0.5);

  const exchange_viewer = new ExchangeViewerRu(exchange);
  exchange_viewer.placeHTMLBlock();
  css.append(exchange_viewer.css);

  Settings.placeHTMLBlock();
  css.append(Settings.css);

  const price_comparison = new PriceComparison(exchange, Settings.app_settings.comparison);
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


class SubscriptionElementPrecise extends PriceElementPrecise {
  _getContent(item) {
    let whole_string = item.innerHTML.split('/');
    if (whole_string.length === 1) {return null;}
    this._post_element = ' /' + whole_string[1];
    let [pre_element, price] = whole_string[0].match(/^[^\d]*(?=\d)|\d.*/g);
    this._pre_element = (pre_element ?? '');
    price = price.trim().replace(' ', '');

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
    this._element.id = 'cve__exchangeviewer';
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
      margin-right: 6px;
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
    let install_steam = document.querySelector('.header_installsteam_btn');
    parent_block.insertBefore(this._element, install_steam);
  }

  get element() {
    return this._element;
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
    if (document.querySelector('#error_box')) {
        this._query_selector = '.page_content_ctn > .page_content';
    } else {
        this._query_selector = '#game_area_purchase';
    }
    console.log(this._query_selector);
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
    }
    .game_purchase_action_bg {
      background-color: #000;
      border-radius: 2px;
      padding: 2px 2px 2px 0px;
    }
    .game_purchase_action_bg > * {
      display:inline-block;
      margin-left: 2px;
      vertical-align: middle;
    }
    .cve__discount_pct, .cve__discount_prices {
      display: inline-block;
      height: 32px;
      font-size: 25px;
      vertical-align: middle;
      padding: 0px 6px;
    }
    .cve__discount_pct {line-height:32px;}`;
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
    let h1_element;
    if (document.querySelector("#appHubAppName")) {
        h1_element = '<h1>Стоимость игры ' + document.querySelector("#appHubAppName").textContent + ' в других регионах</h1>';
    } else {
        h1_element = '<h1>Стоимость игры в других регионах</h1>';
    }
    let price_elements = '';
    let items = this._other_items;
    items.sort((a, b) => a.discount(this._nominal_item, this._exchange) - b.discount(this._nominal_item, this._exchange));
    items.forEach((item) => {
      price_elements += '<div class="game_purchase_action_bg">';
      price_elements += '<div class="game_purchase_discount">';
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
    let div_element = '<div class="cve__discount_pct discount_pct';
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
      return '<div class="cve__discount_prices discount_prices comparison_element__price comparison_element__price_unavailable">unavailable</div>';
    }
    return '<div class="cve__discount_prices discount_prices comparison_element__price">' + item.price_string(this._exchange) + '</div>';
  }

  _flag_element(item) {
    let flag_link = 'https://flagcdn.com/h40/' + item + '.webp';
    return '<img class="comparison_element__flag" src="' + flag_link + '" alt="' + item + '" title="' + item + '">';
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
    if (!(Array.isArray(path) && path.length === 1 && path[0] === '')) {
      this._path = path;
    }
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


class Settings {
  static app_settings = {}
  static default_settings = JSON.parse(`
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
  static html_element;
  static append_button = undefined;

  static {
    let app_settings_string = GM_getValue('settings', null);
    if (app_settings_string === null) {
      this.app_settings = JSON.parse(JSON.stringify(this.default_settings));
      GM_setValue('settings', JSON.stringify(this.default_settings));
    } else {
      this.app_settings = JSON.parse(app_settings_string);
    }
  }

  static placeHTMLBlock() {
    this._placeSettingsButton();
    this._placeHTMLBlock();
    this.appendEventListeners();
  }

  static _comparison_item(cc, path, sign) {
    let template_comparison = document.createElement('div');
    template_comparison.className = 'cve__settings_comparison_item';
    template_comparison.innerHTML = `<div class="cve__comparison_item_buttons">
                                       <div class="item item_delete">x</div>
                                       <div class="item item_moveup">⬆</div>
                                       <div class="item item_movedown">⬇</div>
                                     </div>
                                     <label>CC<input type="text" class="cc" value="`+ cc +`" /></label>
                                     <label>Путь<input type="text" class="path" value="`+ path +`" /></label>
                                     <label>Знак<input type="text" class="sign" value="`+ sign +`" /></label>`;
    return template_comparison;
  }

  static _placeSettingsButton() {
    this._settings_button = document.createElement('div');
    this._settings_button.innerHTML = '<div class="cve__cog-rotate">⚙️</div>'; // ⚙ or ⚙️
    this._settings_button.className = 'cve__settings_open-button';
    this._settings_button.title = 'Настройки расширения cross-value exchange';
    let install_steam = document.querySelector('.header_installsteam_btn');
    document.getElementById('global_action_menu').insertBefore(this._settings_button, install_steam);
  }

  static _placeHTMLBlock() {
    this.html_element = document.createElement('div');
    this.html_element.className = 'cve__settings_lightbox';
    this.html_element.id = 'cve__settings_lightbox';
    this.html_element.style.display = 'none';

    let close_button = document.createElement('div');
    close_button.className = 'cve__settings_close-button';
    close_button.innerHTML = 'X';
    this.html_element.append(close_button);

    let popup_inner = this._createPopupInner();

    let popup = document.createElement('div');
    popup.className = 'cve__settings_popup';
    popup.append(popup_inner);
    popup.innerHTML += this._popup_buttons;
    this.html_element.append(popup);
    document.body.appendChild(this.html_element);
    this._addEventListenersToInner();
  }

  static appendEventListeners() {
    this.html_element.addEventListener('click', (event) => {
      if (event.target === this.html_element) {
        this.html_element.style.display = 'none';
        document.body.style.overflow = '';
      }
    });

    this._settings_button.addEventListener('click', () => {
      this.html_element.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });

    const reset_button = document.querySelector('#cve__settings_reset');
    reset_button.addEventListener('click', () => {
      if (confirm('Вы уверены? Это действие необратимо вернёт все ваши настройки к виду по умолчанию!')) {
        this.app_settings = JSON.parse(JSON.stringify(this.default_settings));
        document.querySelector('.cve__settings_popup_inner').innerHTML = this._createPopupInner().innerHTML;
        this._addEventListenersToInner();
      }
    });

    const cancel_button = document.querySelector('#cve__settings_cancel');
    cancel_button.addEventListener('click', () => {
      if (cancel_button.dataset.cveСancelСonfirmation === "True") {
          document.querySelector('.cve__settings_popup_inner').innerHTML = this._createPopupInner().innerHTML;
          this._addEventListenersToInner();
          cancel_button.dataset.cveСancelСonfirmation = "False";
          cancel_button.classList.remove('cve__button_red');
          cancel_button.innerHTML = '<span>Отмена</span>';
      } else {
          cancel_button.dataset.cveСancelСonfirmation = "True";
          cancel_button.classList.add('cve__button_red');
          cancel_button.innerHTML = '<span>Вы уверены?</span>';
      }
    });
    const apply_button = document.querySelector('#cve__settings_apply');
    apply_button.addEventListener('click', () => {
      this._saveSettingsFromForm(document.querySelector('.cve__settings_popup_inner'));
      //alert("Сохранено");
      apply_button.innerHTML = '<span>✓&nbsp;&nbsp;&nbsp;&nbsp;Сохранено</span>';
      setTimeout(() => location.reload(), 500);

    })
  }

  static _addEventListenersToInner() {
    const append_button = document.getElementById('cve__settings_comparison_append')
    append_button.addEventListener('click', () => {
      const comparison_item = this._comparison_item('', '', '');
      document.querySelector('.cve__settings_comparison_items').insertBefore(comparison_item, append_button);
      this._addEventListenerToComparison(comparison_item);
    });

    const comparison_elements = document.querySelectorAll('.cve__settings_comparison_item');
    comparison_elements.forEach((item) => {
      this._addEventListenerToComparison(item);
    });
  }

  static _addEventListenerToComparison(item) {
    item.querySelector('.item_delete').addEventListener('click', () => {
        item.remove();
      });
    item.querySelector('.item_moveup').addEventListener('click', () => {
      const prev_sibling = item.previousElementSibling;
      if (prev_sibling) {
        item.parentNode.insertBefore(item, prev_sibling);
      }
    });
    item.querySelector('.item_movedown').addEventListener('click', () => {
      const next_sibling = item.nextElementSibling;
      if (next_sibling && next_sibling.id !== 'cve__settings_comparison_append') {
        item.parentNode.insertBefore(next_sibling, item);
      }
    });
  }

  static _createPopupInner() {
    let popup_inner = document.createElement('div');
    popup_inner.className = 'cve__settings_popup_inner';
    popup_inner.innerHTML += `<h1 class="cve__settings_header">Параметры cross-value exchange</h1>
                        <div class="cve__settings_exchange">
                          <label>Ссылка API<input disabled text="text" class="bank_api" value="`+ (this.app_settings.exchange.bank_api_link ?? '') +`" /></label>
                          <div class="from">
                            <label>Валютный знак<input type="text" class="sign" value="`+ (this.app_settings.exchange.from.sign ?? '') +`" /></label>
                            <label>Путь до валюты<input type="text" class="path" value="`+ (this.app_settings.exchange.from.path ?? '') +`" /></label>
                            <label>Обозначение валюты Steam<input type="text" class="steam_variation" value="`+ (this.app_settings.exchange.from.steam_variation ?? '') +`" /></label>
                          </div>
                          <span>=</span>
                          <div class="to">
                            <label>Валютный знак<input type="text" class="sign" value="`+ (this.app_settings.exchange.to.sign ?? '') +`" /></label>
                            <label>Путь до валюты<input type="text" class="path" value="`+ (this.app_settings.exchange.to.path ?? '') +`" /></label>
                            <label>Обозначение валюты Steam<input type="text" class="steam_variation" value="`+ (this.app_settings.exchange.to.steam_variation ?? '') +`" /></label>
                          </div>
                          <div class="api_path">
                            <label>Путь до курса<input type="text" class="value" value="`+ (this.app_settings.exchange.api_path.value ?? '') +`" /></label>
                            <label>Путь до множителя курса<input type="text" class="nominal" value="`+ (this.app_settings.exchange.api_path.nominal ?? '') +`" /></label>
                          </div>
                        </div>
                        <div class="delimiter"></div>`;
    let comparison_items = document.createElement('div');
    comparison_items.className = 'cve__settings_comparison_items';
    this.app_settings.comparison.forEach(item => {
      comparison_items.append(this._comparison_item(item.cc ?? '', item.path ?? '', item.sign ?? ''));
    });
    comparison_items.append(this._popup_appendbutton);

    popup_inner.append(comparison_items);
    return popup_inner;
  }

  static get _popup_buttons() {
    return `<div class="cve__popup_buttons">
              <div class="btnv6_blue_hoverfade btn_medium cve__button cve__button_red" id="cve__settings_reset"><span>СБРОС</span></div>
              <div class="cve__popup_buttons_right">
                <div class="btnv6_blue_hoverfade btn_medium cve__button" id="cve__settings_cancel"><span>Отмена</span></div>
                <div class="btn_green_steamui btn_medium cve__button" id="cve__settings_apply"><span>Применить</span></div>
              </div>
            </div>`;
  }

  static get _popup_appendbutton() {
    this.append_button = document.createElement('a');
    this.append_button.className = 'btnv6_blue_hoverfade btn_medium cve__button';
    this.append_button.setAttribute('id', 'cve__settings_comparison_append');
    this.append_button.style.marginTop = '5px';
    this.append_button.innerHTML = '<span>Добавить страну</span>';
    return this.append_button;
  }

  static _saveSettingsFromForm(element) {
    // this.app_settings.exchange.bank_api_link = element.querySelector('.bank_api').value;
    this.app_settings.exchange.api_path.value = element.querySelector('.api_path .value').value.split(',');
    this.app_settings.exchange.api_path.nominal = element.querySelector('.api_path .nominal').value.split(',');

    this.app_settings.exchange.from.sign = element.querySelector('.from .sign').value;
    this.app_settings.exchange.from.path = element.querySelector('.from .path').value.split(',');
    this.app_settings.exchange.from.steam_variation = element.querySelector('.from .steam_variation').value;

    this.app_settings.exchange.to.sign = element.querySelector('.to .sign').value;
    this.app_settings.exchange.to.path = element.querySelector('.to .path').value.split(',');
    this.app_settings.exchange.to.steam_variation = element.querySelector('.to .steam_variation').value;

    this.app_settings.comparison = [];
    element.querySelectorAll('.cve__settings_comparison_item').forEach((item) => {
      const cc = item.querySelector('.cc').value;
      const path_input = item.querySelector('.path').value;
      let path = '';
      if (path_input) {
        path = item.querySelector('.path').value.split(',');
      }
      const sign = item.querySelector('.sign').value;

      this.app_settings.comparison.push({cc, path, sign});
    });

    GM_setValue('settings', JSON.stringify(this.app_settings));
  }

  static get css() {
    return `
      .cve__settings_lightbox {
        position:fixed;
        z-index:9999;
        top:0;
        left:0;
        width:100%;
        height:100%;
        background-color: rgba(0, 0, 0, 0.65);
        display:none;
        align-items: center;
        justify-content: center;
        cursor:pointer;
      }
      .cve__settings_close-button {
        pointer-events: none;
        user-select: none;
        position: fixed;
        top: 30px;
        right: 30px;
        font-size: 2rem;
        color:white;
      }
      .cve__settings_popup {
        width: 800px;
        background-color: #1b2838;
        cursor: default;
        border-radius:5px;
      }
      .cve__settings_popup_inner {
        width: 100%;
        box-sizing:border-box;
        height: 600px;
        3px 3px 0px rgba( 255, 255, 255, 0.2);
        display:flex;
        flex-direction:column;
        align-items:center;
        padding: 20px;
        gap: 35px;
        overflow-y: auto;
      }
      .cve__popup_buttons {
        background-color: #ffffff10;
        width: 100%;
        box-sizing:border-box;
        padding: 16px;
        display:flex;
        flex-direction:row;
        justify-content: space-between;
      }
      .cve__popup_buttons_right {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        gap: 7px;
      }

      .cve__button {
        cursor: pointer;
        user-select: none;
      }
      .cve__button_red, #cve__settings_reset {
        background-color: rgba(245, 103, 103, 0.1);
        color: #f56767!important;
      }
      .cve__button_red:hover, #cve__settings_reset:hover {
        background: linear-gradient( -60deg, #9b4141 5%,#f56767 95%)!important;
        color: white!important;
      }
      #cve__settings_apply span {
        padding-left: 25px;
        padding-right: 25px;
      }

      .cve__settings_popup_inner input {
        background-color: #316282;
        border-radius: 3px;
        border: 1px solid rgba(0, 0, 0, 0.3);
        box-shadow: 1px 1px 0px rgba( 255, 255, 255, 0.2);
        color:white;
        height: 27px;
        padding: 0px 6px;
        margin-left: 10px;
      }
      .cve__settings_exchange {
        display:flex;
        flex-direction:column;
        align-items:center;
        gap: 20px;
      }
      .cve__settings_comparison_item {
        display:flex;
        gap: 15px;
        padding: 3px 7px;
      }
      .cve__settings_comparison_item:nth-child(2n) {
        background-color: #ffffff10;
        border-radius: 3px;
      }
      .cve__comparison_item_buttons {
        display:flex;
        align-items:center;
        gap: 6px;
      }
      .cve__comparison_item_buttons .item {
        height: 1em;
        aspect-ratio: 1 / 1;
        padding: 3px 5px 5px 5px;
        text-align: center;
        font-weight:bold;
        border-radius: 1000px;
        cursor:pointer;
        user-select: none;
        &.item_delete {
          background-color: #6b2922;
          color: #ee112b;
        }
        &.item_moveup, &.item_movedown {
          background-color: #4c6b22;
          color: #BEEE11;
        }
      }
      .cve__settings_comparison_item .cc, .cve__settings_comparison_item .sign, .cve__settings_exchange .sign, .cve__settings_exchange .steam_variation {
        width: 2em;
      }

      .cve__settings_comparison_items > div:first-of-type .item_moveup, .cve__settings_comparison_items > div:last-of-type  .item_movedown {
        background-color: grey;
        pointer-events: none;
      }
      .cve__settings_open-button {
        display: inline-block;
        position: relative;
        height: 24px;
        line-height: 24px;
        font-size: 16px;
        background-color: rgba(103, 112, 123, 0.2);
        padding-left: 5px;
        padding-right: 5px;
        color: rgb(229, 228, 220);
        margin-right: 6px;
      }
      .cve__settings_open-button:hover{
        background-color: #3d4450;
        transition-property: background;
        transition-duration: 250ms;
        cursor:pointer;
      }
      .cve__cog-rotate {
        transition: transform .3s ease-in-out;
      }
      .cve__cog-rotate:hover {
        transform: rotate(-90deg)!important;
      }
    `;
  }
}


main();
