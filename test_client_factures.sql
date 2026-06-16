SELECT numero, "totalTTC", type, "clientId"
FROM "Facture"
WHERE "clientId" IN (
  '26d94400-3d27-430c-be7f-9b3282e21cbd',
  '629c9194-9e89-4237-b52b-55b3745aa9fb',
  '47f105ef-3d38-4161-a0d8-82066766ce06',
  '5d92b892-d451-4b43-8c11-7773ea6a0282',
  'a52e5cd3-7d50-4531-8f87-3286e6e51632'
);
