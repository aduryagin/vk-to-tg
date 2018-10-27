CREATE TABLE public.vk_publics
(
    last_viewed_post_date TIMESTAMP WITH TIME ZONE,
    url character varying(32) COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT vk_publics_pkey PRIMARY KEY (url)
)
WITH (
    OIDS = FALSE
);

CREATE TABLE public.planned
(
    file_id character varying(1000) COLLATE pg_catalog."default" NOT NULL,
    type character varying(8) COLLATE pg_catalog."default" NOT NULL,
    "time" timestamp(4) with time zone NOT NULL,
    CONSTRAINT planned_pkey PRIMARY KEY (file_id)
)
WITH (
    OIDS = FALSE
);
