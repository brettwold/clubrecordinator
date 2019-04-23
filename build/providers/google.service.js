"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var readline = require("readline");
var googleapis_1 = require("googleapis");
var asa_service_1 = require("./asa.service");
var default_swimdata_1 = require("../models/default.swimdata");
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
var TOKEN_PATH = './token.json';
var TARGET_SPREADSHEET = '1SLGdn2I07mtM8cesfShDrAE5Xpfj7DY9lBiQoRJWgUM';
var GoogleService = /** @class */ (function () {
    function GoogleService() {
        this.swimData = default_swimdata_1.DefaultSwimData.DATA;
    }
    GoogleService.prototype.parseResponses = function () {
        var _this = this;
        var self = this;
        fs.readFile('./credentials.json', function (err, content) {
            if (err)
                return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Sheets API.
            _this.authorize(JSON.parse(content.toString()));
        });
    };
    /**
     * Create an OAuth2 client with the given credentials, and then execute the
     * given callback function.
     * @param {Object} credentials The authorization client credentials.
     */
    GoogleService.prototype.authorize = function (credentials) {
        var self = this;
        var _a = credentials.installed, client_secret = _a.client_secret, client_id = _a.client_id, redirect_uris = _a.redirect_uris;
        var oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        // Check if we have previously stored a token.
        fs.readFile(TOKEN_PATH, function (err, token) {
            if (err)
                return self.getNewToken(oAuth2Client);
            oAuth2Client.setCredentials(JSON.parse(token.toString()));
            self.listMajors(oAuth2Client);
        });
    };
    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
     */
    GoogleService.prototype.getNewToken = function (oAuth2Client) {
        var self = this;
        var authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        console.log('Authorize this app by visiting this url:', authUrl);
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('Enter the code from that page here: ', function (code) {
            rl.close();
            oAuth2Client.getToken(code, function (err, token) {
                if (err)
                    return console.error('Error while trying to retrieve access token', err);
                oAuth2Client.setCredentials(token);
                // Store the token to disk for later program executions
                fs.writeFile(TOKEN_PATH, JSON.stringify(token), function (err) {
                    if (err)
                        return console.error(err);
                    console.log('Token stored to', TOKEN_PATH);
                });
                self.listMajors(oAuth2Client);
            });
        });
    };
    /**
     * Prints the names and majors of students in a sample spreadsheet:
     * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
     * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
     */
    GoogleService.prototype.listMajors = function (auth) {
        var self = this;
        var sheets = googleapis_1.google.sheets({ version: 'v4', auth: auth });
        sheets.spreadsheets.values.get({
            spreadsheetId: TARGET_SPREADSHEET,
            range: "'Form responses 1'!B2:I2",
        }, function (err, res) {
            if (err)
                return console.log('The API returned an error: ' + err);
            var rows = res.data.values;
            if (rows.length) {
                console.log('Email, ASA, Name, Course, Distance, Stroke, Date Set, Time, Processed:');
                // Print columns A and E, which correspond to indices 0 and 4.
                rows.map(function (row) {
                    console.log(row[0] + ", " + row[1] + ", " + row[2] + ", " + row[3] + ", " + row[4] + ", " + row[5] + ", " + row[6] + ", " + row[7] + ", " + row[8]);
                    var asaService = new asa_service_1.AsaService();
                    asaService.getSwimmer(row[1]).subscribe(function (swimmer) {
                        self.markAsProcessed(row);
                        var recordTime = asaService.findTimeMatch(swimmer, row[3], row[4], row[5], row[6], row[7]);
                        if (recordTime.time > 0) {
                            console.log('Time match found');
                            console.log(recordTime);
                            self.updateRecord(recordTime);
                            self.sendMatchEmail(row);
                        }
                        else {
                            console.log('No time match found');
                            self.sendNoMatchEmail(row);
                        }
                    });
                });
            }
            else {
                console.log('No data found.');
            }
        });
    };
    GoogleService.prototype.markAsProcessed = function (responseRow) {
    };
    GoogleService.prototype.updateRecord = function (swimtime) {
    };
    GoogleService.prototype.sendNoMatchEmail = function (row) {
    };
    GoogleService.prototype.sendMatchEmail = function (row) {
    };
    return GoogleService;
}());
exports.GoogleService = GoogleService;
