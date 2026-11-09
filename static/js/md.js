/**
 * md.js — Markdown → HTML (полный набор, используется сайтом и редактором админки).
 *
 * Поддерживает:
 *   **жирный**, __подчёркнутый__, ~~зачёркнутый~~, *курсив*
 *   `код` и ```блоки кода```
 *   # … ###### заголовки, > цитаты, --- горизонтальная линия
 *   - / * / + маркированные, 1. / 1) нумерованные списки
 *   [ссылки](url), ![картинки](url)
 *   | таблицы | с выравниванием (:---, :---:, ---:)
 *   пустая строка = абзац
 *
 * Символы разметки в лимит объёма не входят — считается только видимый текст
 * (см. mdPlainLength).
 */
(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Разрешённые протоколы ссылок/картинок (javascript:/data: не проходят)
  function safeUrl(u) {
    var s = String(u == null ? '' : u).trim();
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(s)) return s.replace(/"/g, '%22');
    return '';
  }

  // Инлайн-разметка. Вызывается уже для экранированного текста.
  // Код (`…`) вырезается заранее в render(), здесь — остальное.
  function inline(s) {
    return s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, alt, url, title) {
        var u = safeUrl(url);
        return u ? '<img src="' + u + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : '') + '>'
                 : '<span>' + alt + '</span>';
      })
      .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, txt, url, title) {
        var u = safeUrl(url);
        return u ? '<a href="' + u + '"' + (title ? ' title="' + title + '"' : '') + '>' + txt + '</a>'
                 : '<span>' + txt + '</span>';
      })
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<u>$1</u>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  }

  function isTableSeparator(line) {
    return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.indexOf('-') !== -1;
  }

  function splitRow(line) {
    return line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map(function (c) { return c.trim(); });
  }

  // Выравнивание из строки-разделителя: :--- → left, :---: → center, ---: → right
  function alignOf(sep) {
    return splitRow(sep).map(function (c) {
      var left = /^:/.test(c), right = /:$/.test(c);
      if (left && right) return ' style="text-align:center"';
      if (right) return ' style="text-align:right"';
      if (left) return ' style="text-align:left"';
      return '';
    });
  }

  function renderTable(rows) {
    var head = splitRow(rows[0]);
    var aligns = alignOf(rows[1] || '');
    var body = rows.slice(2); // строка |---|---| между заголовком и телом
    var html = '<table class="md-table"><thead><tr>';
    head.forEach(function (h, k) { html += '<th' + (aligns[k] || '') + '>' + inline(esc(h)) + '</th>'; });
    html += '</tr></thead>';
    if (body.length) {
      html += '<tbody>';
      body.forEach(function (r) {
        html += '<tr>';
        splitRow(r).forEach(function (c, k) { html += '<td' + (aligns[k] || '') + '>' + inline(esc(c)) + '</td>'; });
        html += '</tr>';
      });
      html += '</tbody>';
    }
    return html + '</table>';
  }

  // Плейсхолдеры кода: инлайн `…` и блоки ```…``` защищаются от прочей разметки
  function protectCode(text, store) {
    text = text.replace(/```([\s\S]*?)```/g, function (m, body) {
      store.push('<pre class="md-code"><code>' + esc(body.replace(/^\n/, '')) + '</code></pre>');
      return '\u0000CODE' + (store.length - 1) + '\u0000';
    });
    text = text.replace(/`([^`\n]+)`/g, function (m, body) {
      store.push('<code class="md-inline-code">' + esc(body) + '</code>');
      return '\u0000CODE' + (store.length - 1) + '\u0000';
    });
    return text;
  }

  function restoreCode(html, store) {
    return html.replace(/\u0000CODE(\d+)\u0000/g, function (m, n) { return store[Number(n)] || ''; });
  }

  /** Markdown → HTML */
  function render(src) {
    var text = String(src || '');
    if (!text.trim()) return '';

    var codeStore = [];
    text = protectCode(text.replace(/\r\n/g, '\n'), codeStore);
    var lines = text.split('\n');
    var out = [];
    var para = [];
    var list = null; // 'ul' | 'ol' | null
    var i = 0;

    function flushPara() {
      if (!para.length) return;
      out.push('<p>' + inline(esc(para.join('\n'))).replace(/\n/g, '<br>') + '</p>');
      para = [];
    }
    function flushList() {
      if (!list) return;
      out.push('<' + list + '>' +
        listItems.map(function (it) { return '<li>' + inline(esc(it)) + '</li>'; }).join('') +
        '</' + list + '>');
      list = null;
      listItems = [];
    }
    var listItems = [];

    while (i < lines.length) {
      var line = lines[i];
      var t = line.trim();

      // код-блок-плейсхолдер (```…```) — отдельный абзац
      if (/^\u0000CODE\d+\u0000$/.test(t)) {
        flushPara();
        flushList();
        out.push(t);
        i++;
        continue;
      }

      // таблица: текущая + следующая строка с |-|- и разделитель
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        flushPara();
        flushList();
        var rows = [];
        while (i < lines.length && lines[i].indexOf('|') !== -1) {
          rows.push(lines[i]);
          i++;
        }
        out.push(renderTable(rows));
        continue;
      }

      // пустая строка — конец блока
      if (!t) {
        flushPara();
        flushList();
        i++;
        continue;
      }

      // горизонтальная линия (---, ***, ___)
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
        flushPara();
        flushList();
        out.push('<hr>');
        i++;
        continue;
      }

      // цитата (> …), в том числе многострочная
      if (/^>\s?/.test(t)) {
        flushPara();
        flushList();
        var quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          quote.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote class="md-quote">' + inline(esc(quote.join('\n'))).replace(/\n/g, '<br>') + '</blockquote>');
        continue;
      }

      // заголовок H1–H6 (# … ######). Уровни 1–2 → h2–h3 (h1 на страницах занят),
      // чтобы заголовки новости не конкурировали с <h1> шаблона. ### → h4 и т.д.
      var h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushPara();
        flushList();
        var lvl = Math.min(h[1].length + 1, 6);
        out.push('<h' + lvl + '>' + inline(esc(h[2])) + '</h' + lvl + '>');
        i++;
        continue;
      }

      // маркированный список
      var ul = t.match(/^[-*+]\s+(.*)$/);
      if (ul) {
        flushPara();
        if (list !== 'ul') flushList();
        list = 'ul';
        listItems.push(ul[1]);
        i++;
        continue;
      }

      // нумерованный список
      var ol = t.match(/^\d+[.)]\s+(.*)$/);
      if (ol) {
        flushPara();
        if (list !== 'ol') flushList();
        list = 'ol';
        listItems.push(ol[1]);
        i++;
        continue;
      }

      // обычный текст
      flushList();
      para.push(t);
      i++;
    }

    flushPara();
    flushList();
    return restoreCode(out.join('\n'), codeStore);
  }

  /**
   * Длина видимого текста: Markdown-разметка не считается.
   * Нужна для лимита 9999 символов в админке.
   */
  function plainLength(src) {
    return plainText(src).length;
  }

  /** Видимый текст без разметки — он же идёт в предпросмотр. */
  function plainText(src) {
    return String(src || '')
      .replace(/```[\s\S]*?```/g, ' ')          // код-блоки
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')    // картинки
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // ссылки
      .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ') // разделители таблиц
      .replace(/\|/g, ' ')                      // ячейки таблиц
      .replace(/^#{1,6}\s+/gm, '')              // заголовки
      .replace(/^\s*>\s?/gm, '')                // цитаты
      .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')      // горизонтальные линии
      .replace(/^\s*[-*+]\s+/gm, '')            // маркированные списки
      .replace(/^\s*\d+[.)]\s+/gm, '')          // нумерованные списки
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Короткий текст для предпросмотра: первые N символов без разметки. */
  function preview(src, max) {
    var plain = plainText(src);
    var n = max || 200;
    return plain.length > n ? plain.slice(0, n).trim() + '…' : plain;
  }

  // globalThis, а не window — тот же файл использует генератор статики (Node)
  globalThis.MD = { render: render, plainText: plainText, plainLength: plainLength, preview: preview };
})();
