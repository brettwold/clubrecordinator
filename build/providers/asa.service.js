"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Observable_1 = require("rxjs/Observable");
var default_swimdata_1 = require("../models/default.swimdata");
var swimmer_1 = require("../models/swimmer");
var swimtime_1 = require("../models/swimtime");
var timeutils_service_1 = require("./timeutils.service");
var rx_http_request_1 = require("@akanass/rx-http-request");
var jsdom_1 = require("jsdom");
var moment = require("moment");
require("rxjs/Rx");
var jsdom = new jsdom_1.JSDOM();
var $ = require("jquery")(jsdom.window);
var timeUtils = new timeutils_service_1.TimeUtils();
var AsaService = /** @class */ (function () {
    function AsaService() {
        this.swimData = default_swimdata_1.DefaultSwimData.DATA;
    }
    AsaService.prototype.getSwimmer = function (id) {
        var _this = this;
        var url = AsaService.ASA_URL + AsaService.INDIVIDUAL_BEST + id;
        console.log(url);
        return rx_http_request_1.RxHR.get(url)
            .map(function (res) { return _this.extractData(res); })
            .catch(this.handleError);
    };
    AsaService.prototype.getSwimmerTimes = function (id, race_type) {
        var _this = this;
        var asaStroke = this.getAsaStrokeCode(race_type);
        var asaCourse = this.getAsaCourseCode(race_type);
        var url = AsaService.ASA_URL + AsaService.STROKE_HISTORY + id + AsaService.ATTR_STOKE_TYPE + asaStroke + AsaService.ATTR_COURSE_TYPE + asaCourse;
        return rx_http_request_1.RxHR.get(url)
            .map(function (res) { return _this.extractTimes(id, race_type, res); })
            .catch(this.handleError);
    };
    AsaService.prototype.removeBrackets = function (str) {
        return str.replace(/\(|\)/g, '');
    };
    AsaService.prototype.getFirstName = function (str) {
        return str.split(' ').slice(0, -1).join(' ');
    };
    AsaService.prototype.getLastName = function (str) {
        return str.split(' ').slice(-1).join(' ');
    };
    AsaService.prototype.removeExtraWhitespace = function (str) {
        return str.replace(/\s{2,}/g, ' ').trim();
    };
    AsaService.prototype.formatDate = function (str) {
        return moment(str, 'DD/MM/YY').format('YYYY-MM-DD');
    };
    AsaService.prototype.formatDateLongYear = function (str) {
        return moment(str, 'DD/MM/YYYY').format('YYYY-MM-DD');
    };
    AsaService.prototype.processName = function (data, str) {
        var namesArr = str.split(" - ");
        if (namesArr.length == 3) {
            var name_1 = this.removeExtraWhitespace(namesArr[0]);
            data.first_name = this.getFirstName(name_1);
            data.last_name = this.getLastName(name_1);
            data.regno = this.removeBrackets(namesArr[1]);
            data.club = namesArr[2];
        }
        else {
            data.last_name = str;
        }
    };
    AsaService.prototype.processDistanceAndStroke = function (data, course_type, str) {
        var strokeArr = str.split(" ");
        if (strokeArr.length >= 2) {
            for (var idx in this.swimData.races) {
                var race = this.swimData.races[idx];
                if (race.distance == strokeArr[0] &&
                    race.stroke == AsaService.STROKE_LOOKUP[strokeArr[1]] &&
                    race.course_type == course_type) {
                    data.race_type = idx;
                }
            }
        }
    };
    AsaService.prototype.processBestTimeTables = function (dom, swimmer) {
        var _this = this;
        swimmer.times = [];
        dom.find('#rankTable').each(function (rankTableIndex, rankTable) {
            $(rankTable).find('tr').each(function (i, row) {
                var time = new swimtime_1.SwimTime({});
                var selectcol = $(row).find('td');
                var course_type = "LC";
                if ($(rankTable).prev('p').text().indexOf('Short') > -1) {
                    course_type = "SC";
                }
                if (selectcol.eq(0).text() != "") {
                    _this.processDistanceAndStroke(time, course_type, selectcol.eq(0).text().trim());
                    if (selectcol.eq(0).children()[0].tagName == 'A') {
                        time.more = true;
                    }
                    else {
                        time.more = false;
                    }
                    time.source = "ASA";
                    time.setFormattedTime(selectcol.eq(1).text().trim());
                    time.fina_points = +selectcol.eq(2).text().trim();
                    time.setDateAchieved(_this.formatDate(selectcol.eq(3).text().trim()));
                    time.meet_name = selectcol.eq(4).text().trim();
                    time.venue = selectcol.eq(5).text().trim();
                    time.license = selectcol.eq(6).text().trim();
                    time.level = +selectcol.eq(7).text().trim();
                    time.round = 'U';
                    time.conv = _this.getConvertedTime(time);
                    swimmer.times.push(time);
                }
            });
        });
    };
    AsaService.prototype.getConvertedTime = function (time) {
        var timeinsecs = time.time / 100;
        var race = this.swimData.races[time.race_type];
        var distPerHund = race.distance / 100;
        var numbTurnFactor = distPerHund * distPerHund * 2;
        if (race.turn_factor) {
            if (time.race_type > 200) {
                var t25 = timeinsecs - ((race.turn_factor / timeinsecs) * numbTurnFactor);
                return Math.round(t25 * 10) * 10;
            }
            else {
                var t50 = this.solveQuadraticEquation(1, -1 * timeinsecs, -1 * race.turn_factor * numbTurnFactor);
                return Math.round(t50 * 10) * 10;
            }
        }
        return 0;
    };
    AsaService.prototype.solveQuadraticEquation = function (a, b, c) {
        return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    };
    AsaService.prototype.processAllTimeTables = function (dom, times, regno, race_type) {
        var self = this;
        dom.find('#rankTable').first().find('tr').each(function (i, row) {
            var time = new swimtime_1.SwimTime({});
            var selectcol = $(row).find('td');
            if (selectcol.eq(0).text() != "") {
                time.swimmer_regno = regno;
                time.race_type = race_type;
                time.source = "ASA";
                time.setFormattedTime(selectcol.eq(0).text().trim());
                time.fina_points = +selectcol.eq(1).text().trim();
                time.setDateAchieved(self.formatDate(selectcol.eq(3).text().trim()));
                time.meet_name = selectcol.eq(4).text().trim();
                time.venue = selectcol.eq(5).text().trim();
                time.level = +selectcol.eq(7).text().trim();
                times.push(time);
            }
        });
    };
    AsaService.prototype.findTimeMatch = function (swimmer, course, distance, stroke, recordDate, recordTime) {
        var race = this.getRaceType(course, distance, stroke);
        if (race) {
            for (var _i = 0, _a = swimmer.times; _i < _a.length; _i++) {
                var time = _a[_i];
                if (time.race_type == race.id) {
                    if (this.formatDateLongYear(recordDate) == time.date && timeUtils.getHundredthsFromString(recordTime) == time.time) {
                        return time;
                    }
                }
            }
        }
        return new swimtime_1.SwimTime({});
    };
    AsaService.prototype.getRaceType = function (course, distance, stroke) {
        for (var i in this.swimData.races) {
            var race = this.swimData.races[i];
            if (race.course_type == course && race.distance == distance && race.stroke == AsaService.STROKE_LOOKUP[stroke]) {
                return race;
            }
        }
        return null;
    };
    AsaService.prototype.getAsaStrokeCode = function (race_type) {
        return this.swimData.races[race_type].asa_stroke;
    };
    AsaService.prototype.getAsaCourseCode = function (race_type) {
        return this.swimData.races[race_type].asa_course;
    };
    AsaService.prototype.extractData = function (res) {
        var dom = $(res.body);
        var swimmer = {};
        var names = dom.find('.rankingsContent p').first().text();
        this.processName(swimmer, names);
        this.processBestTimeTables(dom, swimmer);
        var newSwimmer = new swimmer_1.Swimmer(swimmer);
        return newSwimmer;
    };
    AsaService.prototype.extractTimes = function (regno, race_type, res) {
        var dom = $(res.body);
        var times = new Array();
        this.processAllTimeTables(dom, times, regno, race_type);
        return times;
    };
    AsaService.prototype.handleError = function (error) {
        // In a real world app, we might use a remote logging infrastructure
        console.error(error);
        return Observable_1.Observable.throw(error);
    };
    AsaService.ASA_URL = 'https://swimmingresults.org/';
    AsaService.INDIVIDUAL_BEST = 'individualbest/personal_best.php?mode=A&tiref=';
    AsaService.STROKE_HISTORY = 'individualbest/personal_best_time_date.php?mode=A&tiref=';
    AsaService.ATTR_STOKE_TYPE = '&tstroke=';
    AsaService.ATTR_COURSE_TYPE = '&tcourse=';
    AsaService.STROKE_LOOKUP = {
        'Freestyle': 'FS',
        'Breaststroke': 'BR',
        'Backstroke': 'BK',
        'Butterfly': 'BF',
        'Individual': 'IM',
    };
    return AsaService;
}());
exports.AsaService = AsaService;
