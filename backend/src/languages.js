// Languages the judge accepts, mapped to Judge0 CE 1.13.1 language ids.
// Versions are fixed by the Judge0 image; check them with GET <JUDGE0_URL>/languages.
// `options` are passed to the compiler (GCC 9.2 defaults to older standards otherwise).
const LANGUAGES = {
  python: { id: 71, label: "Python 3.8" },
  c: { id: 50, label: "C (GCC 9.2, C17)", options: "-std=c17 -O2" },
  cpp: { id: 54, label: "C++17 (GCC 9.2)", options: "-std=c++17 -O2" },
  java: { id: 62, label: "Java 13 (OpenJDK)" },
};

// Fields to send to Judge0 for a given language key, or null if the language is unknown.
function judge0Fields(language) {
  const entry = LANGUAGES[language];
  if (!entry) return null;
  return { language_id: entry.id, ...(entry.options ? { compiler_options: entry.options } : {}) };
}

module.exports = { LANGUAGES, judge0Fields };
