chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "rdg-get-usd-gbp-rate") {
    fetch("https://api.frankfurter.app/latest?from=USD&to=GBP")
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, rate: data.rates.GBP }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep the message channel open for the async response
  }
  return false;
});
