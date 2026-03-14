const { runImportTests } = await import("../.tmp-tests/tests/domain/import.test.js");

runImportTests();
console.log("test checks passed");
