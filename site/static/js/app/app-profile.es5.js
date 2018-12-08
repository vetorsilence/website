/*! Built with http://stenciljs.com */
App.loadBundle('app-profile', ['exports'], function (exports) {
    var h = window.App.h;
    var Context = window.App.Context;
    var AppProfile = /** @class */ (function () {
        function AppProfile() {
        }
        AppProfile.prototype.render = function () {
            if (this.match && this.match.params.name) {
                return (h("div", { class: 'app-profile' }, h("p", null, "Hello! My name is ", this.match.params.name, ". My name was passed in through a route param!")));
            }
        };
        Object.defineProperty(AppProfile, "is", {
            get: function () { return "app-profile"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(AppProfile, "properties", {
            get: function () { return { "match": { "type": "Any", "attr": "match" } }; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(AppProfile, "style", {
            get: function () { return ".app-profile {\n  padding: 10px;\n}"; },
            enumerable: true,
            configurable: true
        });
        return AppProfile;
    }());
    exports.AppProfile = AppProfile;
    Object.defineProperty(exports, '__esModule', { value: true });
});
