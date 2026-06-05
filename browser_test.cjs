const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:5173/playground');
  
  // Wait for Codepad editor to load and be ready
  await page.waitForSelector('.cm-content');

  // Type Hello into CodeMirror
  await page.click('.cm-content');
  
  // Clear any existing contents
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');

  // Type Hello
  await page.type('.cm-content', 'Hello');
  
  console.log("Typed Hello. Clicking Sim REPL...");

  // Click Sim. REPL button
  const simReplButton = await page.$x("//button[contains(text(), 'Sim. REPL')]");
  if (simReplButton.length > 0) {
    await simReplButton[0].click();
    console.log("Clicked button, waiting a bit...");
  } else {
    console.log("Button not found. HTML: ", await page.content());
  }

  // Wait to see if error translates
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  if (html.includes('Professor Chu')) {
      console.log('Professor Chu translator was rendered.');
  }

  await browser.close();
})();
