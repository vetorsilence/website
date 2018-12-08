/*! Built with http://stenciljs.com */
App.loadBundle('cdn-rating', ['exports'], function (exports) {
    var h = window.App.h;
    var Context = window.App.Context;
    var AppProfile = /** @class */ (function () {
        function AppProfile() {
            this.rating = 0;
        }
        AppProfile.prototype.render = function () {
            var _this = this;
            return (h("span", { class: "rating" }, ['*', '*', '*', '*', '*'].map(function (_s, i) { return h("span", { class: i + 1 <= _this.rating ? 'active' : 'inactive' }, "\u2605"); })));
        };
        Object.defineProperty(AppProfile, "is", {
            get: function () { return "cdn-rating"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(AppProfile, "properties", {
            get: function () { return { "rating": { "type": Number, "attr": "rating" } }; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(AppProfile, "style", {
            get: function () { return "cdn-rating {\n  color: #ddd;\n}\n\ncdn-rating .active {\n  color: #FFDA42;\n}"; },
            enumerable: true,
            configurable: true
        });
        return AppProfile;
    }());
    exports.CdnRating = AppProfile;
    Object.defineProperty(exports, '__esModule', { value: true });
});
