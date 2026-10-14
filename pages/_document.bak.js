import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        <script
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyClDZQu-blBl1tX6i5ClN_29TgzPne2yW0"
          async
          defer
        ></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}