import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** توقيع APK (v2 — كافٍ لأندرويد 7 فأحدث) والتحقق منه باستخدام مكتبة apksig الرسمية من Google */
public class Signer {
    public static void main(String[] a) throws Exception {
        if (a.length < 5) {
            System.err.println("Usage: Signer <in.apk> <out.apk> <keystore.p12> <alias> <password>");
            System.exit(2);
        }
        char[] pass = a[4].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        ks.load(new FileInputStream(a[2]), pass);
        PrivateKey key = (PrivateKey) ks.getKey(a[3], pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[3]);
        ApkSigner.SignerConfig cfg = new ApkSigner.SignerConfig.Builder("JAMIYATI", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(cfg))
                .setInputApk(new File(a[0]))
                .setOutputApk(new File(a[1]))
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false) // minSdk 24: يكفي مخطط v2
                .setV2SigningEnabled(true)
                .setCreatedBy("Jamiyati build")
                .build()
                .sign();
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[1])).build().verify();
        System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
        for (Object e : r.getErrors()) System.out.println("ERROR " + e);
        if (!r.isVerified()) System.exit(1);
    }
}
