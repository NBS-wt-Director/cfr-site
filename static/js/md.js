/**
 * md.js — минимальный Markdown → HTML.
 *
 * Поддерживает то, что даёт панель форматирования в админке:
 *   **жирный**, __подчёркнутый__, ~~зачёркнутый~~
 *   # заголовки, - списки, | таблицы |, пустая строка = абзац
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

  // Инлайн-разметка. Вызывается уже для экранированного текста.
  function inline(s) {
    return s
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

  function renderTable(rows) {
    var head = splitRow(rows[0]);
    var body = rows.slice(2); // строка |---|---| между заголовком и телом
    var html = '<table class="md-table"><thead><tr>';
    head.forEach(function (h) { html += '<th>' + inline(esc(h)) + '</th>'; });
    html += '</tr></thead>';
    if (body.length) {
      html += '<tbody>';
      body.forEach(function (r) {
        html += '<tr>';
        splitRow(r).forEach(function (c) { html += '<td>' + inline(esc(c)) + '</td>'; });
        html += '</tr>';
      });
      html += '</tbody>';
    }
    return html + '</table>';
  }

  /** Markdown → HTML */
  function render(src) {
    var text = String(src || '');
    if (!text.trim()) return '';

    var lines = text.replace(/\r\n/g, '\n').split('\n');
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

      var t = line.trim();

      // пустая строка — конец блока
      if (!t) {
        flushPara();
        flushList();
        i++;
        continue;
      }

      // заголовок
      var h = t.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushPara();
        flushList();
        var lvl = Math.min(h[1].length + 1, 5); // # → h2, ## → h3 ...
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
    return out.join('\n');
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
