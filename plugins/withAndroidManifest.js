const { withAndroidManifest } = require('@expo/config-plugins');

const withFCMColor = (config) => {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    const metaDataList = mainApplication['meta-data'] || [];

    metaDataList.forEach((metaData) => {
      if (
        metaData.$['android:name'] ===
        'com.google.firebase.messaging.default_notification_color'
      ) {
        metaData.$['tools:replace'] = 'android:resource';
      }
    });

    return config;
  });
};

module.exports = withFCMColor;