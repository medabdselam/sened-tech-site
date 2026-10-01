(function () {
  var hint = document.getElementById('languageHint');
  if (!hint) return;
  try {
    hint.hidden = localStorage.getItem('sened_tech_language_hint_seen') === '1';
    localStorage.setItem('sened_tech_language_hint_seen', '1');
  } catch (e) { hint.hidden = false; }
  var dismiss = document.getElementById('dismissLanguageHint');
  if (dismiss) dismiss.addEventListener('click', function () { hint.hidden = true; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hint.hidden = true; });
})();
