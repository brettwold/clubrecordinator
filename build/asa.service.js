"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var http_provider_1 = require("./http.provider");
var swimmer_1 = require("../models/swimmer");
var swimtime_1 = require("../models/swimtime");
var moment = __importStar(require("moment"));
require("rxjs/Rx");
var AsaService = /** @class */ (function (_super) {
    __extends(AsaService, _super);
    function AsaService(http, env, swimData) {
        var _this = _super.call(this) || this;
        _this.http = http;
        _this.env = env;
        _this.swimData = swimData;
        _this.INDIVIDUAL_BEST = 'individualbest/personal_best.php?mode=A&tiref=';
        _this.STROKE_HISTORY = 'individualbest/personal_best_time_date.php?mode=A&tiref=';
        _this.ATTR_STOKE_TYPE = '&tstroke=';
        _this.ATTR_COURSE_TYPE = '&tcourse=';
        _this.STROKE_LOOKUP = {
            'Freestyle': 'FS',
            'Breaststroke': 'BR',
            'Backstroke': 'BK',
            'Butterfly': 'BF',
            'Individual': 'IM',
        };
        _this.asa_url = env.getAsaUrl();
        return _this;
    }
    AsaService.prototype.getSwimmer = function (id) {
        var _this = this;
        var url = this.asa_url + this.INDIVIDUAL_BEST + id;
        console.log(url);
        return this.http.get(url)
            .map(function (res) { return _this.extractData(res); })
            .catch(this.handleError);
    };
    AsaService.prototype.getSwimmerTimes = function (id, race_type) {
        var _this = this;
        var asaStroke = this.getAsaStrokeCode(race_type);
        var asaCourse = this.getAsaCourseCode(race_type);
        var url = this.asa_url + this.STROKE_HISTORY + id + this.ATTR_STOKE_TYPE + asaStroke + this.ATTR_COURSE_TYPE + asaCourse;
        return this.http.get(url)
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
                    race.stroke == this.STROKE_LOOKUP[strokeArr[1]] &&
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
            jQuery(rankTable).find('tr').each(function (i, row) {
                var time = new swimtime_1.SwimTime({});
                var selectcol = jQuery(row).find('td');
                var course_type = "LC";
                if (jQuery(rankTable).prev('p').text().indexOf('Short') > -1) {
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
                    time.fina_points = selectcol.eq(2).text().trim();
                    time.setDateAchieved(_this.formatDate(selectcol.eq(3).text().trim()));
                    time.meet_name = selectcol.eq(4).text().trim();
                    time.venue = selectcol.eq(5).text().trim();
                    time.license = selectcol.eq(6).text().trim();
                    time.level = selectcol.eq(7).text().trim();
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
            var selectcol = jQuery(row).find('td');
            if (selectcol.eq(0).text() != "") {
                time.swimmer_regno = regno;
                time.race_type = race_type;
                time.source = "ASA";
                time.setFormattedTime(selectcol.eq(0).text().trim());
                time.fina_points = selectcol.eq(1).text().trim();
                time.setDateAchieved(self.formatDate(selectcol.eq(3).text().trim()));
                time.meet_name = selectcol.eq(4).text().trim();
                time.venue = selectcol.eq(5).text().trim();
                time.level = selectcol.eq(7).text().trim();
                times.push(time);
            }
        });
    };
    AsaService.prototype.getAsaStrokeCode = function (race_type) {
        return this.swimData.races[race_type].asa_stroke;
    };
    AsaService.prototype.getAsaCourseCode = function (race_type) {
        return this.swimData.races[race_type].asa_course;
    };
    AsaService.prototype.extractData = function (res) {
        var dom = jQuery(res.text());
        var swimmer = {};
        var names = dom.find('.rankingsContent p').first().text();
        this.processName(swimmer, names);
        this.processBestTimeTables(dom, swimmer);
        var newSwimmer = new swimmer_1.Swimmer(swimmer);
        return newSwimmer;
    };
    AsaService.prototype.extractTimes = function (regno, race_type, res) {
        var dom = jQuery(res.text());
        var times = new Array();
        this.processAllTimeTables(dom, times, regno, race_type);
        return times;
    };
    AsaService = __decorate([
        core_1.Injectable()
    ], AsaService);
    return AsaService;
}(http_provider_1.HttpProvider));
exports.AsaService = AsaService;
