const Settings = require("../models/Settings");

const getSetting = async (key, defaultValue = null) => {
  try {
    const setting = await Settings.findOne({ key });
    return setting ? setting.value : defaultValue;
  } catch (err) {
    console.error(`Error getting setting ${key}:`, err);
    return defaultValue;
  }
};

module.exports = { getSetting };
