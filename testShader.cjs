const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR LOG:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  // Navigate to local dev server
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.log('Navigation timeout'));

  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await browser.close();
  console.log('TEST COMPLETE');
})();
