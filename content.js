(function () {
  const DEVEX_USD_PER_ROBUX = 0.0038;
  const RATE_CACHE_KEY = "rdg_usd_gbp_rate";
  const RATE_CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours
  const BALANCE_CACHE_MS = 60 * 1000;
  const SCAN_INTERVAL_MS = 2000;

  let gbpPerUsd = null;
  let cachedBalance = null;
  let cachedBalanceTime = 0;
  let currentUserId = null;
  const processed = new WeakSet();

  async function fetchJson(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.json();
  }

  async function getUserId() {
    if (currentUserId) return currentUserId;
    try {
      const data = await fetchJson(
        "https://users.roblox.com/v1/users/authenticated",
      );
      currentUserId = data.id;
      return currentUserId;
    } catch (e) {
      console.warn("[Robux to GBP] failed to get authenticated user", e);
      return null;
    }
  }

  async function getExactBalance() {
    if (
      cachedBalance != null &&
      Date.now() - cachedBalanceTime < BALANCE_CACHE_MS
    ) {
      return cachedBalance;
    }
    const userId = await getUserId();
    if (!userId) return null;
    try {
      const data = await fetchJson(
        `https://economy.roblox.com/v1/users/${userId}/currency`,
      );
      cachedBalance = data.robux;
      cachedBalanceTime = Date.now();
      return cachedBalance;
    } catch (e) {
      console.warn("[Robux to GBP] failed to get exact balance", e);
      return null;
    }
  }

  async function getUsdToGbpRate() {
    if (gbpPerUsd) return gbpPerUsd;
    try {
      const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || "null");
      if (cached && Date.now() - cached.time < RATE_CACHE_MS) {
        gbpPerUsd = cached.rate;
        return gbpPerUsd;
      }
    } catch (e) {
      /* ignore bad cache */
    }
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "rdg-get-usd-gbp-rate" }, (res) => {
          if (chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError.message));
          else resolve(res);
        });
      });
      if (!response || !response.ok)
        throw new Error(response && response.error);
      gbpPerUsd = response.rate;
      localStorage.setItem(
        RATE_CACHE_KEY,
        JSON.stringify({ rate: gbpPerUsd, time: Date.now() }),
      );
      return gbpPerUsd;
    } catch (e) {
      console.warn("[Robux to GBP] failed to fetch exchange rate", e);
      return null;
    }
  }

  function toGbp(robux, rate) {
    return robux * DEVEX_USD_PER_ROBUX * rate;
  }

  function formatGbp(amount) {
    return amount.toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function makeInlineNode(text) {
    const span = document.createElement("span");
    span.className = "rdg-inline";
    span.textContent = text;
    return span;
  }
  function annotateNavbarBalance(rate, exactBalance) {
    if (exactBalance == null) return;
    const candidates = Array.from(
      document.querySelectorAll('header *, [class*="nav" i] *'),
    ).filter(
      (el) =>
        el.children.length === 0 &&
        /^\d[\d,.]*\s*[KMB]?\+?$/i.test((el.textContent || "").trim()),
    );
    const anchor = candidates.find((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 && rect.top < 120 && rect.width > 0 && rect.width < 160
      );
    });
    if (!anchor || processed.has(anchor)) return;

    const gbp = toGbp(exactBalance, rate);
    anchor.insertAdjacentElement(
      "afterend",
      makeInlineNode(`(${formatGbp(gbp)})`),
    );
    processed.add(anchor);
  }

  let communityFundsAnnotated = false;
  function annotateCommunityFunds(rate) {
    if (
      communityFundsAnnotated &&
      document.querySelector(".rdg-community-funds")
    )
      return;

    const AMOUNT_RE = /^\d{1,3}(,\d{3})*$/;
    const all = document.querySelectorAll("body *");
    for (const el of all) {
      if (el.children.length > 0) continue;
      if (processed.has(el)) continue;
      const text = (el.textContent || "").trim();
      if (!AMOUNT_RE.test(text)) continue;

      let container = el.parentElement;
      let isCommunityFunds = false;
      for (let i = 0; i < 3 && container; i++) {
        const containerText = (container.textContent || "").trim();
        if (
          /Community\s+Funds/i.test(containerText) &&
          containerText.length < 60
        ) {
          isCommunityFunds = true;
          break;
        }
        container = container.parentElement;
      }
      if (!isCommunityFunds) continue;

      const amount = parseInt(text.replace(/,/g, ""), 10);
      if (!Number.isFinite(amount)) continue;

      const gbp = toGbp(amount, rate);
      const node = makeInlineNode(`(${formatGbp(gbp)})`);
      node.classList.add("rdg-community-funds");
      el.insertAdjacentElement("afterend", node);
      processed.add(el);
      communityFundsAnnotated = true;
      break;
    }
  }

  function annotateGenericRobuxAmounts(rate) {
    const AMOUNT_RE = /^-?\d{1,3}(,\d{3})*$/;
    const all = document.querySelectorAll("body *");
    for (const el of all) {
      if (el.children.length > 0) continue; // leaf nodes only
      if (processed.has(el)) continue;
      const text = (el.textContent || "").trim();
      if (!AMOUNT_RE.test(text)) continue;

      const parent = el.parentElement;
      if (!parent) continue;
      const hasIcon =
        parent.querySelector(
          'svg, [class*="icon-robux" i], [class*="robux-icon" i]',
        ) ||
        (parent.previousElementSibling &&
          parent.previousElementSibling.querySelector &&
          parent.previousElementSibling.querySelector(
            'svg, [class*="icon-robux" i]',
          ));
      if (!hasIcon) continue;

      const amount = parseInt(text.replace(/,/g, ""), 10);
      if (!Number.isFinite(amount) || amount === 0) {
        processed.add(el);
        continue;
      }
      const gbp = toGbp(Math.abs(amount), rate);
      const sign = amount < 0 ? "-" : "";
      el.insertAdjacentElement(
        "afterend",
        makeInlineNode(`(${sign}${formatGbp(gbp)})`),
      );
      processed.add(el);
    }
  }

  async function scan() {
    const rate = await getUsdToGbpRate();
    if (rate == null) return;
    const exactBalance = await getExactBalance();

    annotateNavbarBalance(rate, exactBalance);
    annotateCommunityFunds(rate);
    annotateGenericRobuxAmounts(rate);
  }

  scan();
  setInterval(scan, SCAN_INTERVAL_MS);
})();
