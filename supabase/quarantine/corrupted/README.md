# Corrupted migration quarantine

These files are historical evidence only. **Do not apply, source, concatenate,
or copy SQL fragments from them.** Each one is truncated mid-statement and then
contains AI-generated Markdown/prose. They also conflict with one another and
with the current application contract.

| File | Source commit | Original SHA-256 | First known break |
|---|---|---|---|
| `001_dashboard_additions.sql` | `06ea018` | `cd5dc31a68413914116bf73af60df9bd3f382f532c7ef5d4cf8852b07260c874` | line 56: incomplete `ADD`; prose begins line 58 |
| `20240115_student_dashboard.sql` | `c3ea7d8` | `269ff95911a58480d6db102959111007f855549293be7ed2b7952efb1d042e26` | line 13: unterminated `LIKE`; prose begins line 15 |
| `20241201_student_dashboard.sql` | `0b7f4ad` | `008c0a9d82e4718c70b94348483c630638f960166d619b9b495749f7e39199df` | line 148: incomplete function; prose begins line 150 |

The hashes refer to the original CRLF files before quarantine. Git may normalize
line endings, so they are provenance records rather than current-file checksums.
