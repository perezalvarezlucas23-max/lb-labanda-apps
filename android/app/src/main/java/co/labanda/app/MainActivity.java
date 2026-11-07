package co.labanda.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Contenedor Android de la app web (PWA) de La Banda.
 * Carga la dirección publicada en GitHub Pages: cada vez que se publica una versión nueva
 * de la app web, los celulares la reciben sin reinstalar el APK.
 */
public class MainActivity extends Activity {

    private WebView web;
    private String host;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        host = Uri.parse(BuildConfig.START_URL).getHost();
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " LBApp/" + BuildConfig.VERSION_NAME);

        web.addJavascriptInterface(new Puente(), "LBAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (host != null && host.equals(u.getHost())) return false;   // la app sigue dentro
                abrirFuera(u);                                                // WhatsApp, mapas, enlaces externos
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame() && !hayInternet()) {
                    view.loadData("<html><body style='background:#0E0E0F;color:#F4F1EA;font-family:sans-serif;display:flex;"
                            + "align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px'>"
                            + "<div><h2>Sin conexión</h2><p>Revisa tu internet y vuelve a abrir la app.</p></div></body></html>",
                            "text/html; charset=utf-8", "UTF-8");
                }
            }
        });

        setContentView(web);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(BuildConfig.START_URL);
    }

    private void abrirFuera(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No hay una app para abrir este enlace", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean hayInternet() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo n = cm != null ? cm.getActiveNetworkInfo() : null;
        return n != null && n.isConnected();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** Lo que la app web le pide al celular: abrir archivos (cita para el calendario, reporte en Excel). */
    private class Puente {
        @JavascriptInterface
        public void abrirArchivo(String nombre, String tipo, String contenido) {
            runOnUiThread(() -> {
                try {
                    File dir = new File(getCacheDir(), "compartidos");
                    if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("sin carpeta");
                    String limpio = nombre.replaceAll("[^A-Za-z0-9._-]", "_");
                    File f = new File(dir, limpio);
                    try (FileOutputStream o = new FileOutputStream(f)) { o.write(contenido.getBytes(StandardCharsets.UTF_8)); }
                    Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".archivos", f);
                    Intent ver = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, tipo).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try {
                        startActivity(ver);
                    } catch (ActivityNotFoundException e) {
                        Intent enviar = new Intent(Intent.ACTION_SEND).setType(tipo).putExtra(Intent.EXTRA_STREAM, uri)
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(enviar, nombre));
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "No se pudo abrir el archivo", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
