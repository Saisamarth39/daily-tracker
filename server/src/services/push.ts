import webPush from 'web-push';
import fs from 'fs';
import path from 'path';

let vapidPublic = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivate = process.env.VAPID_PRIVATE_KEY || '';

// Auto-generate VAPID keys if not present in env
if (!vapidPublic || !vapidPrivate) {
  console.log('VAPID keys not configured in environment. Generating new keys...');
  const keys = webPush.generateVAPIDKeys();
  vapidPublic = keys.publicKey;
  vapidPrivate = keys.privateKey;
  
  // Try to write keys back to the server's .env file
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/VAPID_PUBLIC_KEY=".*"/, `VAPID_PUBLIC_KEY="${vapidPublic}"`);
      envContent = envContent.replace(/VAPID_PRIVATE_KEY=".*"/, `VAPID_PRIVATE_KEY="${vapidPrivate}"`);
      
      // If the variables were empty strings without quotes or need to be appended:
      if (!envContent.includes(`VAPID_PUBLIC_KEY="${vapidPublic}"`)) {
        envContent = envContent.replace(/VAPID_PUBLIC_KEY=.*/, `VAPID_PUBLIC_KEY="${vapidPublic}"`);
      }
      if (!envContent.includes(`VAPID_PRIVATE_KEY="${vapidPrivate}"`)) {
        envContent = envContent.replace(/VAPID_PRIVATE_KEY=.*/, `VAPID_PRIVATE_KEY="${vapidPrivate}"`);
      }
      
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('Successfully saved generated VAPID keys to server/.env file.');
    }
  } catch (err) {
    console.warn('Could not write generated VAPID keys back to .env:', err);
  }
}

webPush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@orbit-track.com',
  vapidPublic,
  vapidPrivate
);

export const getVapidPublicKey = () => vapidPublic;

export interface PushSubscriptionInput {
  endpoint: string;
  keysAuth: string;
  keysP256dh: string;
}

export const sendPushNotification = async (
  subscription: { endpoint: string; keysAuth: string; keysP256dh: string },
  payload: string
) => {
  const pushSub = {
    endpoint: subscription.endpoint,
    keys: {
      auth: subscription.keysAuth,
      p256dh: subscription.keysP256dh
    }
  };

  try {
    await webPush.sendNotification(pushSub, payload);
    console.log(`Successfully sent push notification to ${subscription.endpoint}`);
    return true;
  } catch (err: any) {
    console.error(`Failed to send push notification to ${subscription.endpoint}:`, err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`Subscription ${subscription.endpoint} is expired/gone. Should delete from DB.`);
      // We return false so the caller knows it is invalid and can clean up
      return false;
    }
    return true; // other network errors, keep subscription
  }
};
