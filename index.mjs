import fetch from 'node-fetch'
import childProcess from 'child_process'
import puppeteer from 'puppeteer'

function findPathOrNull (name) {
  try {
    const dir = childProcess.execSync(`which ${name}`).toString()
    return dir
  } catch (err) {
    if (err) {
      return null
    }
  }
}

function findChrome () {
  const chromeStable = findPathOrNull('google-chrome-stable')
  const chromeUnstable = findPathOrNull('google-chrome-unstable')
  const result = chromeUnstable || chromeStable
  if (!result) {
    return null
  }
  return result.replace(/\n/ig, '')
}

export async function login ({ account, password }) {
  const chromePath = findChrome()
  if (!chromePath) {
    throw new Error('chromePath is not exists')
  }
  const browser = await puppeteer.launch({ executablePath: chromePath})
  const page = await browser.newPage()
  await page.goto('https://codepen.io/login?secure=true')
  await page.type('input#login-email-field', account)
  await page.type('input#login-password-field_', password)
  await page.click('button#log-in-button')
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  const csrf_token = await page.$eval('meta[name="csrf-token"]', el => el.getAttribute('content'))
  const cookie = await page.cookies()
  const user_id = await page.$eval('input#init-data', el => JSON.parse(el.value).__user.id)
  return {
    user_id,
    csrf_token,
    cookie: cookie.map(c => `${c.name}=${c.value}`).join(';')
  }
}


export function saveNeedToken (token) {
  const { csrf_token, cookie, user_id } = token
  return data => fetch('https://codepen.io/pen/save', {
    method: 'POST',
    headers: {
      'x-csrf-token': 'vjVJAnVJDHPEyvWVRfV5npzAwOvASosFvBHG/eeUIxBlEtdCfspn5ZFlzbM0qZitCCFJQOI5nGQgSOHshVv0bw==',
      'content-type': 'application/x-www-form-urlencoded',
      'cookie': '__cfduid=d8f53f361226a0764adbe3454ddc8a4331504533796; _ga=GA1.2.1005750186.1505292312; screen_width=2560; _gid=GA1.2.931724349.1513243744; country=US; __cp_layout=top; last_active_theme_name=default; __stripe_mid=f5cefcb3-3791-4c1f-b05d-78123e55917e; _gat=1; codepen_session=d2pCWHlGS3EzL3hCeXYxLzBackkvRlo5Z2NlWHo0VzgvajhvdGtOWSt4QWNObG1OYjRJV1ArSTJETUg4cDRTUXRnVlUva29zQWpHNVVaeGhzM0pYNG9CQXE2eTRJcVgvUlE4MjZ3THNCNUJydXBTRnl6SkR5a2c4WEUzbmdLQjVhV21vMGl4bXRoTGdBbENiaTNoWHNDaEZ6Wk1makp4ZEF2SkN3SGdhYXlkQ2gwVUViLzJ5SStLZ1h6WnBQR1RzQTQ5SXgzcjBwTkRRUEo1ZUJZY2hJM3g3cWpzRkh0dkk3blVIQmtnellWTnBkZnZqMlNmUkdra2kzdklqekp2bC0tSCtSTHArbmRDVlhjdnZZM3Z0WjR3QT09--0fbd65f899006418528bf98515f981cf818a30c6'
    },
    body: `pen=${JSON.stringify({
      user_id,
      ...data
    })}`
  }).then(res => {
    if (res.status !== 200) {
      throw new Error('http status code is not eq 200')
    }
    return res.json()
  })
  .then(data => {
    if (!data.success) {
      throw new Error('body could not be handle')
    }
    return data.redirect_url
  })
  .catch(err => console.log(err))
}
