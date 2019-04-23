"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var timeutils_service_1 = require("../providers/timeutils.service");
var moment = require("moment");
var timeUtils = new timeutils_service_1.TimeUtils();
var SwimTime = /** @class */ (function () {
    function SwimTime(data) {
        this.source = "";
        this.race_type = -1;
        this.date = "";
        this.unix = -1;
        this.time = -1;
        this.time_orig = "";
        this.conv = -1;
        this.fina_points = -1;
        this.round = "";
        this.meet_name = "";
        this.venue = "";
        this.license = "";
        this.level = -1;
        this.swimmer_regno = -1;
        this.more = false;
        Object.assign(this, data);
    }
    SwimTime.prototype.setFormattedTime = function (timeStr) {
        this.time_orig = timeStr;
        var tenths = timeUtils.getHundredthsFromString(timeStr);
        this.time = tenths;
    };
    SwimTime.prototype.setDateAchieved = function (dateStr) {
        this.unix = moment(dateStr, 'YYYY-MM-DD').unix();
        this.date = dateStr;
    };
    SwimTime.prototype.setData = function (swimTime) {
        Object.assign(this, swimTime);
    };
    return SwimTime;
}());
exports.SwimTime = SwimTime;
