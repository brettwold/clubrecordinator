"use strict";
var Swimmer = (function () {
    function Swimmer(swimmerData) {
        this.regno = "";
        this.first_name = "";
        this.last_name = "";
        this.times = new Array();
        this.club = "";
        this.dob = "";
        this.gender = "";
        Object.assign(this, swimmerData);
    }
    return Swimmer;
}());
exports.Swimmer = Swimmer;
