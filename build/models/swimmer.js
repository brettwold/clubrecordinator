"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Swimmer = /** @class */ (function () {
    function Swimmer(swimmerData) {
        this.regno = "";
        this.first_name = "";
        this.last_name = "";
        this.times = new Array();
        this.club = "";
        this.dob = ""; // YYYY-MM-dd
        this.gender = "";
        Object.assign(this, swimmerData);
    }
    return Swimmer;
}());
exports.Swimmer = Swimmer;
