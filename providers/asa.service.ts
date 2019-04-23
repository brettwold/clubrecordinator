
import { Observable }       from 'rxjs/Observable';

import { DefaultSwimData }  from '../models/default.swimdata';
import { Swimmer }          from '../models/swimmer';
import { SwimTime }         from '../models/swimtime';
import { TimeUtils }         from './timeutils.service';
import { RxHR, RxHttpRequestResponse }             from "@akanass/rx-http-request";
import { JSDOM } from "jsdom";
import * as jquery from "jquery";

import moment = require('moment');
import 'rxjs/Rx';

const jsdom = new JSDOM();
const $ = require("jquery")(jsdom.window) as JQueryStatic;
const timeUtils = new TimeUtils();

export class AsaService {
  static readonly ASA_URL = 'https://swimmingresults.org/';
  static readonly INDIVIDUAL_BEST = 'individualbest/personal_best.php?mode=A&tiref=';
  static readonly STROKE_HISTORY = 'individualbest/personal_best_time_date.php?mode=A&tiref='
  static readonly ATTR_STOKE_TYPE = '&tstroke='
  static readonly ATTR_COURSE_TYPE = '&tcourse='
  static readonly STROKE_LOOKUP :any = {
    'Freestyle': 'FS',
    'Breaststroke': 'BR',
    'Backstroke': 'BK',
    'Butterfly': 'BF',
    'Individual': 'IM',
  };

  private swimData :any;

  constructor () {
    this.swimData = DefaultSwimData.DATA;
  }

  getSwimmer (id: number): Observable<Swimmer> {
    let url = AsaService.ASA_URL + AsaService.INDIVIDUAL_BEST + id;
    console.log( url );
    return RxHR.get(url)
                    .map(res => this.extractData(res))
                    .catch(this.handleError);
  }

  getSwimmerTimes (id: number, race_type: number): Observable<SwimTime[]>  {
    let asaStroke = this.getAsaStrokeCode(race_type);
    let asaCourse = this.getAsaCourseCode(race_type);
    let url = AsaService.ASA_URL + AsaService.STROKE_HISTORY + id + AsaService.ATTR_STOKE_TYPE + asaStroke + AsaService.ATTR_COURSE_TYPE + asaCourse;

    return RxHR.get(url)
                    .map(res => this.extractTimes(id, race_type, res))
                    .catch(this.handleError);
  }

  private removeBrackets (str :string) :string {
    return str.replace(/\(|\)/g,'');
  }

  private getFirstName (str :string) :string {
    return str.split(' ').slice(0, -1).join(' ');
  }

  private getLastName (str :string) :string {
    return str.split(' ').slice(-1).join(' ');
  }

  private removeExtraWhitespace (str :string) :string {
    return str.replace(/\s{2,}/g, ' ').trim();
  }

  private formatDate (str :string) :string {
    return moment(str, 'DD/MM/YY').format('YYYY-MM-DD');
  }

  private formatDateLongYear (str :string) :string {
    return moment(str, 'DD/MM/YYYY').format('YYYY-MM-DD');
  }

  private processName (data :any, str :any) {
    let namesArr = str.split(" - ");

    if(namesArr.length == 3) {
      let name = this.removeExtraWhitespace(namesArr[0]);
      data.first_name = this.getFirstName(name);
      data.last_name = this.getLastName(name);
      data.regno = this.removeBrackets(namesArr[1]);
      data.club = namesArr[2];
    } else {
      data.last_name = str;
    }
  }

  private processDistanceAndStroke(data :any, course_type :string, str :string) {
    let strokeArr = str.split(" ");

    if(strokeArr.length >= 2) {
      for(let idx in this.swimData.races) {
        let race = this.swimData.races[idx];
        if(race.distance == strokeArr[0] &&
          race.stroke == AsaService.STROKE_LOOKUP[strokeArr[1]] &&
          race.course_type == course_type) {
          data.race_type = idx;
        }
      }
    }
  }

  private processBestTimeTables(dom :any, swimmer : Swimmer) {
    swimmer.times = [];

    dom.find('#rankTable').each((rankTableIndex :number, rankTable :any) => {
      $(rankTable).find('tr').each((i :number, row :any) => {
        let time = new SwimTime({});
        let selectcol = $(row).find('td');
        let course_type = "LC";

        if($(rankTable).prev('p').text().indexOf('Short') > -1) {
          course_type = "SC";
        }

        if(selectcol.eq(0).text() != "") {
          this.processDistanceAndStroke(time, course_type, selectcol.eq(0).text().trim());
          if(selectcol.eq(0).children()[0].tagName == 'A') {
            time.more = true;
          } else {
            time.more = false;
          }
          time.source = "ASA";
          time.setFormattedTime(selectcol.eq(1).text().trim());
          time.fina_points = +selectcol.eq(2).text().trim();
          time.setDateAchieved(this.formatDate(selectcol.eq(3).text().trim()));
          time.meet_name = selectcol.eq(4).text().trim();
          time.venue = selectcol.eq(5).text().trim();
          time.license = selectcol.eq(6).text().trim();
          time.level = +selectcol.eq(7).text().trim();
          time.round = 'U';
          time.conv = this.getConvertedTime(time);
          swimmer.times.push(time);
        }
      });
    });
  }

  public getConvertedTime(time :SwimTime) :number {

    let timeinsecs: number = time.time/100;
    let race = this.swimData.races[time.race_type];
    let distPerHund = race.distance/100;
    let numbTurnFactor = distPerHund*distPerHund*2;
    if (race.turn_factor) {
      if (time.race_type > 200) {
        let t25 = timeinsecs - ((race.turn_factor / timeinsecs) * numbTurnFactor);
        return Math.round(t25 * 10) * 10;
      } else {
        let t50 = this.solveQuadraticEquation(1, -1*timeinsecs, -1*race.turn_factor*numbTurnFactor);
        return Math.round(t50 * 10) * 10;
      }
    }
    return 0;
  }

  private solveQuadraticEquation(a: number, b: number, c: number): number {
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }

  private processAllTimeTables(dom: any, times: SwimTime[], regno: number, race_type: number) {
    let self = this;

    dom.find('#rankTable').first().find('tr').each(function(i :number, row :any) {
        let time = new SwimTime({});
        let selectcol = $(row).find('td');

        if(selectcol.eq(0).text() != "") {
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
  }

  public findTimeMatch(swimmer :Swimmer, course :string, distance :number, stroke :string, recordDate :string, recordTime :string) :SwimTime {
    let race = this.getRaceType(course, distance, stroke);
    if(race) {
      for(let time of swimmer.times) {
        if(time.race_type == race.id) {
          if(this.formatDateLongYear(recordDate) == time.date && timeUtils.getHundredthsFromString(recordTime) == time.time) {
            return time;
          }
        }
      }
    }

    return new SwimTime({});
  }

  private getRaceType(course :string, distance :number, stroke :string) :any {
    for(let i in this.swimData.races) {
      let race = this.swimData.races[i];
      if(race.course_type == course && race.distance == distance && race.stroke == AsaService.STROKE_LOOKUP[stroke]) {
        return race;
      }
    }
    return null;
  }

  private getAsaStrokeCode(race_type: number) : string {
    return this.swimData.races[race_type].asa_stroke
  }

  private getAsaCourseCode(race_type: number) : string {
    return this.swimData.races[race_type].asa_course
  }

  private extractData(res :RxHttpRequestResponse) {
    let dom = $(res.body);
    let swimmer :any = {};
    let names = dom.find('.rankingsContent p').first().text();
    this.processName(swimmer, names);
    this.processBestTimeTables(dom, swimmer);

    let newSwimmer = new Swimmer(swimmer);
    return newSwimmer;
  }

  private extractTimes(regno: number, race_type: number, res: RxHttpRequestResponse) {
    let dom = $(res.body);
    let times: Array<SwimTime> = new Array();

    this.processAllTimeTables(dom, times, regno, race_type);

    return times;
  }

  protected handleError (error: any) {
    // In a real world app, we might use a remote logging infrastructure
    console.error(error);
    return Observable.throw(error);
  }
}
