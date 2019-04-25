
import {GoogleService} from './providers/google.service';

const puppeteer = require('puppeteer-core');

var args = process.argv.slice(2);

if(args.length > 0) {
  let goos = new GoogleService(null, true);
  goos.parseResponses();
} else {
  (async () => {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: false
    });
    const page = await browser.newPage();
    await page.goto('https://swimmingresults.org/individualbest/personal_best.php?mode=A&tiref=939148');
    await page.waitForSelector('#rankTable', { timeout: 300000 });

    console.log("You're there");

    let goos = new GoogleService(page, false);
    goos.parseResponses();

    //await browser.close();
  })();
}
