// Uzantı kurulduğunda veya güncellendiğinde çalışır
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cleanSelectedUrlFormatSafe",
    title: "Seçili Metni Temizle (Format Korumalı)",
    contexts: ["selection"] // Sadece metin seçiliyken göster
  });
});

// Sağ tık menü öğesine tıklandığında çalışır
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "cleanSelectedUrlFormatSafe" && info.selectionText) {
    // info.selectionText burada sadece tetikleyici, asıl işlem DOM'da yapılacak.
    if (tab && tab.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [info.frameId || 0] }, // frameId iframe'ler için önemli
        func: processSelectionInPageForCleanup
        // args göndermeye gerek yok, pattern'ler processSelectionInPageForCleanup içinde tanımlı.
      }).catch(err => console.error("Format korumalı temizleme script'i enjekte edilemedi:", err));
    } else {
      console.error("Aktif sekme bulunamadı.");
    }
  }
});

// Bu fonksiyon, aktif sekmenin içeriğinde (content script olarak) çalıştırılacak.
// Seçili metni işlerken formatlamayı korur.
function processSelectionInPageForCleanup() {
  const patterns = [
    // ÖNEMLİ: Kullanıcının ilk isteği "www.google.com/url?sa=E&q=https%3A%2F%2F" -> " " (boşluk) idi.
    // Ancak örnek sonuçta boşluk yoktu ve bu genellikle istenmez.
    // Bu yüzden "" (boş string) ile değiştiriyorum. Eğer gerçekten boşluk isteniyorsa, replaceWith: " " yapılmalı.
    { find: /www\.google\.com\/url\?sa=E&q=https%3A%2F%2F/g, replaceWith: "" },
    { find: /%2F/g, replaceWith: "/" }
  ];

  const activeElement = document.activeElement;
  let textChangedInInputOrTextarea = false;

  // Durum 1: Aktif element bir INPUT veya TEXTAREA ise
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
      typeof activeElement.selectionStart === 'number' && activeElement.selectionStart !== activeElement.selectionEnd) {
    
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    let selectedText = activeElement.value.substring(start, end);
    let processedText = selectedText;

    for (const pattern of patterns) {
      processedText = processedText.replace(pattern.find, pattern.replaceWith);
    }

    if (processedText !== selectedText) {
      const originalValue = activeElement.value;
      activeElement.value = originalValue.substring(0, start) + processedText + originalValue.substring(end);
      
      // İmleci/seçimi güncelle
      activeElement.selectionStart = start;
      activeElement.selectionEnd = start + processedText.length;
      
      textChangedInInputOrTextarea = true;

      // Değişikliği frameworklerin (React, Vue vb.) algılaması için olayları tetikle
      activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      activeElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true })); // Bazı durumlar için
    }
  }

  // Eğer input/textarea'da değişiklik yapıldıysa, burada dur.
  if (textChangedInInputOrTextarea) {
    return;
  }

  // Durum 2: Genel sayfa seçimi (contentEditable veya statik metin)
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    // console.warn("Format korumalı temizleme için aktif bir seçim bulunamadı (input/textarea dışında).");
    return;
  }

  let domChangedOverall = false;

  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    if (range.collapsed) continue;

    const commonAncestor = range.commonAncestorContainer;
    
    // Seçim içindeki metin düğümlerini bulmak için TreeWalker
    const walker = document.createTreeWalker(
      commonAncestor,
      NodeFilter.SHOW_TEXT, // Sadece metin düğümlerini al
      // Filtre: Sadece seçim aralığıyla kesişen metin düğümlerini işle
      {
        acceptNode: function(node) {
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);
          // Range.compareBoundaryPoints:
          // -1: point in range is before point in sourceRange
          //  0: points are at the same position
          //  1: point in range is after point in sourceRange
          // Kesişim kontrolü: (Seçimin sonu düğümün başından sonra VEYA aynı) VE (Seçimin başı düğümün sonundan önce VEYA aynı)
          if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 1 && // selection_end >= node_start
              range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > -1) { // selection_start <= node_end
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodesToModify = [];
    let currentNode;
    while (currentNode = walker.nextNode()) {
      nodesToModify.push(currentNode);
    }

    // Değişiklikleri yaparken, range'in ofsetlerini kaybetmemek için
    // düğümleri ters sırada (veya dikkatlice) işlemek gerekebilir.
    // Ancak her metin düğümü kendi içinde işlendiği için sıralama çok kritik olmayabilir.
    // Önemli olan, bir düğümdeki değişikliklerin diğer düğümlerin ofsetlerini etkilememesi.
    // Bu yaklaşımda her düğüm bağımsız işleniyor.

    for (const textNode of nodesToModify) {
      let originalNodeValue = textNode.nodeValue;
      
      // Bu metin düğümünün seçili olan kısmını belirle
      // Başlangıç ofseti: Eğer düğüm seçimin başladığı düğümse, seçimin başlangıç ofseti, değilse 0.
      const startOffsetInNode = (textNode === range.startContainer) ? range.startOffset : 0;
      // Bitiş ofseti: Eğer düğüm seçimin bittiği düğümse, seçimin bitiş ofseti, değilse düğümün sonu.
      const endOffsetInNode = (textNode === range.endContainer) ? range.endOffset : originalNodeValue.length;

      // Sadece gerçekten seçili olan ve işlenecek kısmı al
      const partToProcess = originalNodeValue.substring(startOffsetInNode, endOffsetInNode);
      
      if (partToProcess.length === 0) continue; // İşlenecek bir şey yoksa atla

      let processedPart = partToProcess;
      for (const pattern of patterns) {
        processedPart = processedPart.replace(pattern.find, pattern.replaceWith);
      }

      if (processedPart !== partToProcess) {
        const newValue = originalNodeValue.substring(0, startOffsetInNode) +
                         processedPart +
                         originalNodeValue.substring(endOffsetInNode);
        textNode.nodeValue = newValue;
        domChangedOverall = true;

        // Range'i güncellemek gerekebilir, özellikle metin uzunluğu değiştiyse.
        // Bu, seçimin doğru kalmasını sağlar.
        if (textNode === range.startContainer) {
          // Eğer başlangıç düğümü değiştiyse ve metin kısaldı/uzadıysa,
          // range.setStart ofsetini ayarlamak gerekebilir.
          // Şimdilik bu karmaşıklığa girmiyoruz, tarayıcı genellikle idare eder.
        }
        if (textNode === range.endContainer) {
          // Benzer şekilde endContainer için de.
          // Yeni bitiş ofseti: startOffsetInNode + processedPart.length
          // Eğer bu düğüm aynı zamanda bitiş düğümüyse:
          if (range.endContainer === textNode) {
            try {
                 range.setEnd(textNode, startOffsetInNode + processedPart.length);
            } catch (e) {
                // console.warn("Range bitişi ayarlanamadı:", e);
            }
          }
        }
      }
    }
  }

  if (domChangedOverall) {
    // `contenteditable` bir alansa ve değişiklik yapıldıysa,
    // `input` event'i tetiklemek, React/Vue gibi frameworklerin durumu algılamasına yardımcı olabilir.
    if (activeElement && activeElement.isContentEditable) {
        activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
    // Seçimi (mavi vurguyu) yenilemek için bazen küçük bir hile gerekebilir.
    // Örneğin, seçimi kaldırıp hemen geri yüklemek.
    // Ancak bu genellikle otomatik olarak düzgün çalışır.
    // window.getSelection().removeAllRanges();
    // window.getSelection().addRange(range); // Değişen range'i geri ekle (dikkatli olunmalı)
  } else if (!textChangedInInputOrTextarea) {
    // console.log("Format korumalı temizlemede değiştirilecek bir şey bulunamadı.");
  }
}