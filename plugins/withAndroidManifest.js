const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = withAndroidManifest(config, async (config) => {
  const mainApplication = config.modResults.manifest.application[0];
  
  const metaDataList = mainApplication['meta-data'] || [];
  
  metaDataList.forEach((metaData) => {
    if (metaData.$['android:name'] === 'com.google.firebase.messaging.default_notification_color') {
      metaData.$['tools:replace'] = 'android:resource';
    }
  });

  return config;
});