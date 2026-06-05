/**
 * Migration script: Legacy levels.json → Scripted Timeline format
 * 
 * Converts the old flat-field StageDef into the new `steps[]` architecture.
 * Run with: node scripts/migrate-levels.js
 */
const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '../src/lib/data/levels.json');
const outputPath = path.resolve(__dirname, '../src/lib/data/levels-migrated.json');

const levels = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

function migrateStage(stage) {
  const steps = [];

  // 1. Guide messages → Dialogue step
  if (stage.guideMessages && stage.guideMessages.length > 0) {
    steps.push({
      type: 'dialogue',
      messages: stage.guideMessages,
      // blockFinalMessage keeps the last dialogue box visible while the user
      // works on the next action (e.g. typing in REPL or opening codepad).
      // We set it to true if the old stage had blockFinalMessage AND there is
      // an action coming after this dialogue.
      blockFinalMessage: !!(stage.blockFinalMessage && (
        stage.replCheck || stage.tests || stage.isCodepadEnabled || stage.requiredPetClicks || stage.isFreeplayMode
      ))
    });
  }

  // 2. Click target action (e.g. "click egg 5 times")
  if (stage.requiredPetClicks) {
    steps.push({
      type: 'action',
      actionType: 'click_target',
      targetClicks: stage.requiredPetClicks
    });
  }

  // 3. REPL check action (e.g. "type sleep() in terminal")
  if (stage.replCheck) {
    const checks = Array.isArray(stage.replCheck) ? stage.replCheck : [stage.replCheck];
    steps.push({
      type: 'action',
      actionType: 'repl_test',
      replChecks: checks
    });
  }

  // 4. If codepad is enabled, inject an open_codepad action
  if (stage.isCodepadEnabled && stage.tests) {
    steps.push({
      type: 'action',
      actionType: 'open_codepad'
    });

    // 4a. Edit guide messages → Dialogue step (shown inside the codepad)
    if (stage.editGuideMessages && stage.editGuideMessages.length > 0) {
      steps.push({
        type: 'dialogue',
        messages: stage.editGuideMessages,
        blockFinalMessage: true // Always keep visible while student codes
      });
    }

    // 4b. Codepad tests
    steps.push({
      type: 'action',
      actionType: 'codepad_test',
      tests: stage.tests
    });

    // 4c. Save & Deploy (always required after codepad tests in legacy format)
    steps.push({
      type: 'action',
      actionType: 'save_and_deploy'
    });
  }

  // 5. Freeplay mode
  if (stage.isFreeplayMode) {
    steps.push({
      type: 'action',
      actionType: 'freeplay'
    });
  }

  // Build the new stage object
  const newStage = {
    id: stage.id,
    title: stage.title,
    steps: steps
  };

  // Preserve optional fields
  if (stage.activeCodeInitial !== undefined) newStage.activeCodeInitial = stage.activeCodeInitial;
  if (stage.lockedCodeInitial !== undefined) newStage.lockedCodeInitial = stage.lockedCodeInitial;
  if (stage.devSolutionCode !== undefined) newStage.devSolutionCode = stage.devSolutionCode;
  if (stage.isReplEnabled !== undefined) newStage.isReplEnabled = stage.isReplEnabled;

  return newStage;
}

const migratedLevels = levels.map(level => ({
  id: level.id,
  title: level.title,
  concept: level.concept,
  stages: level.stages.map(migrateStage)
}));

fs.writeFileSync(outputPath, JSON.stringify(migratedLevels, null, 2), 'utf-8');

// Summary
let totalStages = 0;
let totalSteps = 0;
migratedLevels.forEach(l => {
  l.stages.forEach(s => {
    totalStages++;
    totalSteps += s.steps.length;
  });
});

console.log(`Migration complete!`);
console.log(`  Levels: ${migratedLevels.length}`);
console.log(`  Stages: ${totalStages}`);
console.log(`  Total steps: ${totalSteps}`);
console.log(`  Output: ${outputPath}`);
