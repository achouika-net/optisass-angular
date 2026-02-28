SELECT datname, pg_size_pretty(pg_database_size(datname)) as size 
FROM pg_database 
WHERE datistemplate = false;
