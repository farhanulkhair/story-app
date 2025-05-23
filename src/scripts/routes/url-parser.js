const UrlParser = {
  parseActiveUrlWithCombiner() {
    const url = window.location.hash.slice(1).toLowerCase();
    const splitedUrl = this._urlSplitter(url);
    return this._urlCombiner(splitedUrl);
  },

  parseActiveUrlWithoutCombiner() {
    const url = window.location.hash.slice(1).toLowerCase();
    return this._urlSplitter(url);
  },

  _urlSplitter(url) {
    const urlsSplits = url.split("/");
    return {
      resource: urlsSplits[1] || null,
      id: urlsSplits[2] || null,
      verb: urlsSplits[3] || null,
    };
  },

  _urlCombiner(splitedUrl) {
    let result = splitedUrl.resource ? `/${splitedUrl.resource}` : "/";
    
    if (splitedUrl.resource === "detail") {
      result += "/:id";
    } else if (splitedUrl.id) {
      result += `/${splitedUrl.id}`;
    }
    
    if (splitedUrl.verb) {
      result += `/${splitedUrl.verb}`;
    }
    
    return result;
  },
};

export default UrlParser;
